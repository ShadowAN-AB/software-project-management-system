"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectMember, getTaskProjectId } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadAttachment(
  taskId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const projectId = await getTaskProjectId(taskId);
  if (!projectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(projectId, session.user.id, session.user.role);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  const file = formData.get("file") as File;
  if (!file) return { success: false, error: "No file provided" };
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File too large (max 5MB)" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  await prisma.attachment.create({
    data: {
      filename: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      data: buffer,
      taskId,
      uploadedBy: session.user.id,
    },
  });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  revalidatePath(`/tasks/${taskId}`);
  if (task) revalidatePath(`/projects/${task.projectId}`);

  return { success: true, data: undefined };
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { task: true },
  });

  if (!attachment) return { success: false, error: "Attachment not found" };

  const isMember = await requireProjectMember(attachment.task.projectId, session.user.id, session.user.role);
  if (!isMember) return { success: false, error: "Not a member of this project" };
  const canDelete =
    attachment.uploadedBy === session.user.id ||
    ["ADMIN", "PROJECT_MANAGER"].includes(session.user.role);

  if (!canDelete) return { success: false, error: "Permission denied" };

  await prisma.attachment.delete({ where: { id: attachmentId } });

  revalidatePath(`/tasks/${attachment.taskId}`);
  revalidatePath(`/projects/${attachment.task.projectId}`);

  return { success: true, data: undefined };
}

export async function getAttachments(taskId: string) {
  const session = await auth();
  if (!session?.user) return [];

  const projectId = await getTaskProjectId(taskId);
  if (!projectId) return [];

  const isMember = await requireProjectMember(projectId, session.user.id, session.user.role);
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
