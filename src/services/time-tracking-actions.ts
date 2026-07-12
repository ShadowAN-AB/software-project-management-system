"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectMember, getTaskProjectId, getSprintProjectId , resolveDefaultWorkspace} from "@/lib/authorization";
import { revalidatePath } from "next/cache";

export async function getTimeEntries(taskId: string) {
  const session = await auth();
  if (!session?.user) return [];
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return [];

  const projectId = await getTaskProjectId(taskId);
  if (!projectId) return [];

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return [];

  return prisma.timeEntry.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
  });
}

export async function logTime(
  taskId: string,
  minutes: number,
  description: string | null,
  date: string | null
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const projectId = await getTaskProjectId(taskId);
  if (!projectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  if (minutes <= 0 || minutes > 1440) {
    return { success: false, error: "Minutes must be between 1 and 1440" };
  }

  await prisma.timeEntry.create({
    data: {
      taskId,
      userId: session.user.id,
      minutes,
      description: description || null,
      date: date ? new Date(date) : new Date(),
    },
  });

  const task = await prisma.task.findUnique({ where: { id: taskId } });

  await prisma.activityLog.create({
    data: {
      action: "TIME_LOGGED",
      details: `Logged ${formatMinutes(minutes)}`,
      userId: session.user.id,
      projectId: task?.projectId,
      taskId,
    },
  });

  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${taskId}`);
  return { success: true };
}

export async function deleteTimeEntry(entryId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const entry = await prisma.timeEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { success: false, error: "Entry not found" };

  // Only the person who logged it or admins can delete
  if (entry.userId !== session.user.id && ctx.role !== "ADMIN") {
    return { success: false, error: "Cannot delete others' time entries" };
  }

  await prisma.timeEntry.delete({ where: { id: entryId } });
  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${entry.taskId}`);
  return { success: true };
}

export async function getSprintTimeEntries(sprintId: string) {
  const session = await auth();
  if (!session?.user) return [];
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return [];

  const sprintProjectId = await getSprintProjectId(sprintId);
  if (!sprintProjectId) return [];

  const isMember = await requireProjectMember(sprintProjectId, session.user.id, ctx);
  if (!isMember) return [];

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { tasks: { select: { id: true } } },
  });
  if (!sprint) return [];

  const taskIds = sprint.tasks.map((t) => t.id);
  return prisma.timeEntry.findMany({
    where: { taskId: { in: taskIds } },
    include: {
      user: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: { date: "desc" },
  });
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}
