"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase, ATTACHMENTS_BUCKET } from "@/lib/supabase";
import { requireProjectMember, getTaskProjectId , resolveDefaultWorkspace} from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function uploadAttachment(
  taskId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const projectId = await getTaskProjectId(taskId);
  if (!projectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  const file = formData.get("file") as File;
  if (!file) return { success: false, error: "No file provided" };
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File too large (max 25MB)" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100) || "file";
  const storagePath = `${taskId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` };
  }

  await prisma.attachment.create({
    data: {
      filename: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      storagePath,
      taskId,
      uploadedBy: session.user.id,
    },
  });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${taskId}`);
  if (task) revalidatePath(`/w/${ctx.workspaceSlug}/projects/${task.projectId}`);

  return { success: true, data: undefined };
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { task: true },
  });

  if (!attachment) return { success: false, error: "Attachment not found" };

  const isMember = await requireProjectMember(attachment.task.projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a member of this project" };
  const canDelete =
    attachment.uploadedBy === session.user.id ||
    ["ADMIN", "PROJECT_MANAGER"].includes(ctx.role);

  if (!canDelete) return { success: false, error: "Permission denied" };

  await supabase.storage.from(ATTACHMENTS_BUCKET).remove([attachment.storagePath]);
  await prisma.attachment.delete({ where: { id: attachmentId } });

  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${attachment.taskId}`);
  revalidatePath(`/w/${ctx.workspaceSlug}/projects/${attachment.task.projectId}`);

  return { success: true, data: undefined };
}

export async function getAttachments(taskId: string) {
  const session = await auth();
  if (!session?.user) return [];
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return [];

  const projectId = await getTaskProjectId(taskId);
  if (!projectId) return [];

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return [];

  return prisma.attachment.findMany({
    where: { taskId },
    select: {
      id: true,
      filename: true,
      fileSize: true,
      mimeType: true,
      createdAt: true,
      uploadedBy: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
