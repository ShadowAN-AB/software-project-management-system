"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectMember, getTaskProjectId } from "@/lib/authorization";
import { taskSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { TaskStatus } from "@prisma/client";
import { createNotification } from "@/services/notification-actions";
import { eventBus } from "@/lib/event-bus";
import type { SSEFrame } from "@/lib/sse-events";

export async function getTasksByProject(projectId: string) {
  const session = await auth();
  if (!session?.user) return [];

  const isMember = await requireProjectMember(projectId, session.user.id, session.user.role);
  if (!isMember) return [];

  return prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: true,
      creator: true,
      sprint: true,
      _count: { select: { comments: true } },
      labels: { include: { label: true } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
}

export async function getTask(id: string) {
  const session = await auth();
  if (!session?.user) return null;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: true,
      creator: true,
      sprint: true,
      project: {
        include: {
          members: { select: { userId: true } },
        },
      },
      comments: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
      },
      labels: { include: { label: true } },
    },
  });

  if (!task) return null;

  const isMember = await requireProjectMember(task.projectId, session.user.id, session.user.role);
  if (!isMember) return null;

  return task;
}

export async function createTask(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const projectId = formData.get("projectId") as string;
  if (projectId) {
    const isMember = await requireProjectMember(projectId, session.user.id, session.user.role);
    if (!isMember) return { success: false, error: "Not a member of this project" };
  }

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

  // Notify assignee
  if (task.assigneeId && task.assigneeId !== session.user.id) {
    await createNotification({
      userId: task.assigneeId,
      type: "TASK_ASSIGNED",
      title: "Task Assigned",
      message: `${session.user.name} assigned you "${task.title}"`,
      link: `/tasks/${task.id}`,
    });
  }

  eventBus.emit(`project:${parsed.data.projectId}`, {
    type: "task:created",
    _actorId: session.user.id,
    task: {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      type: task.type,
      dueDate: task.dueDate?.toISOString() ?? null,
      assignee: null,
      labels: [],
      _count: { comments: 0 },
    },
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { success: true, data: undefined };
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const taskProjectId = await getTaskProjectId(taskId);
  if (!taskProjectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(taskProjectId, session.user.id, session.user.role);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  const previousTask = await prisma.task.findUnique({
    where: { id: taskId },
    select: { status: true },
  });

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

  // Notify assignee of status change
  if (task.assigneeId && task.assigneeId !== session.user.id) {
    await createNotification({
      userId: task.assigneeId,
      type: "TASK_STATUS_CHANGED",
      title: "Status Updated",
      message: `${session.user.name} moved "${task.title}" to ${status.replace("_", " ")}`,
      link: `/tasks/${taskId}`,
    });
  }

  eventBus.emit(
    [`project:${task.projectId}`, `task:${taskId}`],
    {
      type: "task:statusChanged",
      _actorId: session.user.id,
      taskId,
      status,
      previousStatus: previousTask?.status ?? status,
    } as SSEFrame
  );

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath(`/tasks/${taskId}`);
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

  const taskProjectId = await getTaskProjectId(taskId);
  if (!taskProjectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(taskProjectId, session.user.id, session.user.role);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...data,
      priority: data.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined,
      type: data.type as "FEATURE" | "BUG" | "IMPROVEMENT" | "TASK" | undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
    },
  });

  eventBus.emit(
    [`project:${task.projectId}`, `task:${taskId}`],
    {
      type: "task:updated",
      _actorId: session.user.id,
      taskId,
      changes: data,
    } as SSEFrame
  );

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath(`/tasks/${taskId}`);
  return { success: true, data: undefined };
}

export async function deleteTask(taskId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const taskProjectId = await getTaskProjectId(taskId);
  if (!taskProjectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(taskProjectId, session.user.id, session.user.role);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  const task = await prisma.task.delete({ where: { id: taskId } });

  eventBus.emit(`project:${task.projectId}`, {
    type: "task:deleted",
    _actorId: session.user.id,
    taskId,
  } as SSEFrame);

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

  const commentProjectId = await getTaskProjectId(taskId);
  if (!commentProjectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(commentProjectId, session.user.id, session.user.role);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  const comment = await prisma.comment.create({
    data: { content, taskId, userId: session.user.id },
  });

  eventBus.emit(`task:${taskId}`, {
    type: "comment:added",
    _actorId: session.user.id,
    taskId,
    comment: {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      user: { id: session.user.id, name: session.user.name, email: session.user.email },
    },
  } as SSEFrame);

  const task = await prisma.task.findUnique({ where: { id: taskId } });

  // Notify assignee and creator about the comment
  const notifyIds = new Set<string>();
  if (task?.assigneeId && task.assigneeId !== session.user.id) notifyIds.add(task.assigneeId);
  if (task?.creatorId && task.creatorId !== session.user.id) notifyIds.add(task.creatorId);

  for (const uid of notifyIds) {
    await createNotification({
      userId: uid,
      type: "COMMENT_ADDED",
      title: "New Comment",
      message: `${session.user.name} commented on "${task?.title}"`,
      link: `/tasks/${taskId}`,
    });
  }

  revalidatePath(`/projects/${task?.projectId}`);
  revalidatePath(`/tasks/${taskId}`);
  return { success: true, data: undefined };
}
