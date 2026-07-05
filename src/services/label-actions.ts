"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

export async function getProjectLabels(projectId: string) {
  return prisma.label.findMany({
    where: { projectId },
    include: { _count: { select: { tasks: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createLabel(
  projectId: string,
  name: string,
  color: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!name.trim()) return { success: false, error: "Label name is required" };

  const existing = await prisma.label.findUnique({
    where: { projectId_name: { projectId, name: name.trim() } },
  });
  if (existing) return { success: false, error: "Label already exists" };

  await prisma.label.create({
    data: { name: name.trim(), color, projectId },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: undefined };
}

export async function deleteLabel(labelId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const label = await prisma.label.delete({ where: { id: labelId } });
  revalidatePath(`/projects/${label.projectId}`);
  return { success: true, data: undefined };
}

export async function addLabelToTask(
  taskId: string,
  labelId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const existing = await prisma.taskLabel.findUnique({
    where: { taskId_labelId: { taskId, labelId } },
  });
  if (existing) return { success: false, error: "Label already added" };

  await prisma.taskLabel.create({ data: { taskId, labelId } });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  revalidatePath(`/tasks/${taskId}`);
  if (task) revalidatePath(`/projects/${task.projectId}`);
  return { success: true, data: undefined };
}

export async function removeLabelFromTask(
  taskId: string,
  labelId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await prisma.taskLabel.deleteMany({ where: { taskId, labelId } });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  revalidatePath(`/tasks/${taskId}`);
  if (task) revalidatePath(`/projects/${task.projectId}`);
  return { success: true, data: undefined };
}

export async function getTaskLabels(taskId: string) {
  return prisma.taskLabel.findMany({
    where: { taskId },
    include: { label: true },
  });
}
