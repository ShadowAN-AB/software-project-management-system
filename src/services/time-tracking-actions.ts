"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getTimeEntries(taskId: string) {
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

  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export async function deleteTimeEntry(entryId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const entry = await prisma.timeEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { success: false, error: "Entry not found" };

  // Only the person who logged it or admins can delete
  if (entry.userId !== session.user.id && session.user.role !== "ADMIN") {
    return { success: false, error: "Cannot delete others' time entries" };
  }

  await prisma.timeEntry.delete({ where: { id: entryId } });
  revalidatePath(`/tasks/${entry.taskId}`);
  return { success: true };
}

export async function getSprintTimeEntries(sprintId: string) {
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
