"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectMember, getTaskProjectId , resolveDefaultWorkspace} from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function getSubtasks(taskId: string) {
  const session = await requireAuth();
  if (!session) return [];
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return [];

  const projectId = await getTaskProjectId(taskId);
  if (!projectId) return [];

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return [];

  return prisma.subtask.findMany({
    where: { taskId },
    orderBy: { order: "asc" },
  });
}

export async function createSubtask(
  taskId: string,
  title: string
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Not authenticated" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "Not authenticated" };

  const projectId = await getTaskProjectId(taskId);
  if (!projectId) return { success: false, error: "Task not found" };

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a project member" };

  const trimmed = title.trim();
  if (!trimmed) return { success: false, error: "Title is required" };

  const maxOrder = await prisma.subtask.aggregate({
    where: { taskId },
    _max: { order: true },
  });

  const subtask = await prisma.subtask.create({
    data: {
      title: trimmed,
      taskId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${taskId}`);
  return { success: true, data: { id: subtask.id } };
}

export async function toggleSubtask(
  subtaskId: string
): Promise<ActionResult<{ completed: boolean }>> {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Not authenticated" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "Not authenticated" };

  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    select: { taskId: true, completed: true },
  });
  if (!subtask) return { success: false, error: "Subtask not found" };

  const projectId = await getTaskProjectId(subtask.taskId);
  if (!projectId) return { success: false, error: "Task not found" };

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a project member" };

  const updated = await prisma.subtask.update({
    where: { id: subtaskId },
    data: { completed: !subtask.completed },
  });

  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${subtask.taskId}`);
  return { success: true, data: { completed: updated.completed } };
}

export async function deleteSubtask(
  subtaskId: string
): Promise<ActionResult<null>> {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Not authenticated" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "Not authenticated" };

  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    select: { taskId: true },
  });
  if (!subtask) return { success: false, error: "Subtask not found" };

  const projectId = await getTaskProjectId(subtask.taskId);
  if (!projectId) return { success: false, error: "Task not found" };

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a project member" };

  await prisma.subtask.delete({ where: { id: subtaskId } });

  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${subtask.taskId}`);
  return { success: true, data: null };
}

export async function updateSubtaskTitle(
  subtaskId: string,
  title: string
): Promise<ActionResult<null>> {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Not authenticated" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "Not authenticated" };

  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    select: { taskId: true },
  });
  if (!subtask) return { success: false, error: "Subtask not found" };

  const projectId = await getTaskProjectId(subtask.taskId);
  if (!projectId) return { success: false, error: "Task not found" };

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a project member" };

  const trimmed = title.trim();
  if (!trimmed) return { success: false, error: "Title is required" };

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: { title: trimmed },
  });

  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${subtask.taskId}`);
  return { success: true, data: null };
}

export async function reorderSubtasks(
  taskId: string,
  orderedIds: string[]
): Promise<ActionResult<null>> {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Not authenticated" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "Not authenticated" };

  const projectId = await getTaskProjectId(taskId);
  if (!projectId) return { success: false, error: "Task not found" };

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a project member" };

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.subtask.update({ where: { id }, data: { order: index } })
    )
  );

  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${taskId}`);
  return { success: true, data: null };
}
