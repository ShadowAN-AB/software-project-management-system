"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { taskSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { TaskStatus } from "@prisma/client";

export async function getTasksByProject(projectId: string) {
  return prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: true,
      creator: true,
      sprint: true,
      _count: { select: { comments: true } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
}

export async function getTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      assignee: true,
      creator: true,
      sprint: true,
      project: true,
      comments: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function createTask(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status") || "BACKLOG",
    priority: formData.get("priority") || "MEDIUM",
    type: formData.get("type") || "TASK",
    assigneeId: formData.get("assigneeId") || null,
    sprintId: formData.get("sprintId") || null,
    dueDate: formData.get("dueDate") || null,
    projectId: formData.get("projectId"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const maxOrder = await prisma.task.aggregate({
    where: { projectId: parsed.data.projectId, status: parsed.data.status as TaskStatus },
    _max: { order: true },
  });

  const task = await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status as TaskStatus,
      priority: parsed.data.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      type: parsed.data.type as "FEATURE" | "BUG" | "IMPROVEMENT" | "TASK",
      assigneeId: parsed.data.assigneeId || null,
      sprintId: parsed.data.sprintId || null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      projectId: parsed.data.projectId,
      creatorId: session.user.id,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "TASK_CREATED",
      details: `Created task "${task.title}"`,
      userId: session.user.id,
      projectId: parsed.data.projectId,
      taskId: task.id,
    },
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { success: true, data: undefined };
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status },
  });

  await prisma.activityLog.create({
    data: {
      action: "TASK_STATUS_CHANGED",
      details: `Changed status to ${status}`,
      userId: session.user.id,
      projectId: task.projectId,
      taskId: task.id,
    },
  });

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, data: undefined };
}

export async function updateTask(
  taskId: string,
  data: {
    title?: string;
    description?: string | null;
    priority?: string;
    type?: string;
    assigneeId?: string | null;
    sprintId?: string | null;
    dueDate?: string | null;
  }
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...data,
      priority: data.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined,
      type: data.type as "FEATURE" | "BUG" | "IMPROVEMENT" | "TASK" | undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
    },
  });

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, data: undefined };
}

export async function deleteTask(taskId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const task = await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, data: undefined };
}

export async function addComment(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const taskId = formData.get("taskId") as string;
  const content = formData.get("content") as string;

  if (!content?.trim()) return { success: false, error: "Comment cannot be empty" };

  await prisma.comment.create({
    data: { content, taskId, userId: session.user.id },
  });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  revalidatePath(`/projects/${task?.projectId}`);
  return { success: true, data: undefined };
}
