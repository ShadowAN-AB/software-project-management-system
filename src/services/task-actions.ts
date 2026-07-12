"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectMember, getTaskProjectId , resolveDefaultWorkspace} from "@/lib/authorization";
import { taskSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import type { TaskStatus } from "@prisma/client";
import { createNotification } from "@/services/notification-actions";
import { eventBus } from "@/lib/event-bus";
import type { SSEFrame } from "@/lib/sse-events";
import { sendTaskAssignedEmail, sendTaskStatusEmail, sendCommentEmail } from "@/lib/email";
import { removeAttachmentObjects } from "@/lib/supabase";

export async function getTasksByProject(projectId: string) {
  const session = await auth();
  if (!session?.user) return [];
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return [];

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
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
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return null;

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

  const isMember = await requireProjectMember(task.projectId, session.user.id, ctx);
  if (!isMember) return null;

  return task;
}

export async function createTask(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const projectId = formData.get("projectId") as string;
  if (projectId) {
    const isMember = await requireProjectMember(projectId, session.user.id, ctx);
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
      workspaceId: ctx.workspaceId,
      userId: task.assigneeId,
      type: "TASK_ASSIGNED",
      title: "Task Assigned",
      message: `${session.user.name} assigned you "${task.title}"`,
      link: `/tasks/${task.id}`,
    });

    const [assignee, project] = await Promise.all([
      prisma.user.findUnique({ where: { id: task.assigneeId }, select: { email: true } }),
      prisma.project.findUnique({ where: { id: parsed.data.projectId }, select: { name: true } }),
    ]);
    if (assignee?.email && project) {
      await sendTaskAssignedEmail(assignee.email, session.user.name ?? "Someone", task.title, task.id, project.name);
    }
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
      order: task.order,
      dueDate: task.dueDate?.toISOString() ?? null,
      assignee: null,
      labels: [],
      _count: { comments: 0 },
    },
  });

  revalidatePath(`/w/${ctx.workspaceSlug}/projects/${parsed.data.projectId}`);
  return { success: true, data: undefined };
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const taskProjectId = await getTaskProjectId(taskId);
  if (!taskProjectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(taskProjectId, session.user.id, ctx);
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
      workspaceId: ctx.workspaceId,
      userId: task.assigneeId,
      type: "TASK_STATUS_CHANGED",
      title: "Status Updated",
      message: `${session.user.name} moved "${task.title}" to ${status.replace("_", " ")}`,
      link: `/tasks/${taskId}`,
    });

    const [assignee, project] = await Promise.all([
      prisma.user.findUnique({ where: { id: task.assigneeId }, select: { email: true } }),
      prisma.project.findUnique({ where: { id: task.projectId }, select: { name: true } }),
    ]);
    if (assignee?.email && project) {
      await sendTaskStatusEmail(assignee.email, session.user.name ?? "Someone", task.title, taskId, previousTask?.status ?? status, status, project.name);
    }
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

  revalidatePath(`/w/${ctx.workspaceSlug}/projects/${task.projectId}`);
  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${taskId}`);
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
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const taskProjectId = await getTaskProjectId(taskId);
  if (!taskProjectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(taskProjectId, session.user.id, ctx);
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

  if (data.assigneeId && data.assigneeId !== session.user.id) {
    const [assignee, project] = await Promise.all([
      prisma.user.findUnique({ where: { id: data.assigneeId }, select: { email: true } }),
      prisma.project.findUnique({ where: { id: task.projectId }, select: { name: true } }),
    ]);
    if (assignee?.email && project) {
      await sendTaskAssignedEmail(assignee.email, session.user.name ?? "Someone", task.title, taskId, project.name);
    }
  }

  eventBus.emit(
    [`project:${task.projectId}`, `task:${taskId}`],
    {
      type: "task:updated",
      _actorId: session.user.id,
      taskId,
      changes: data,
    } as SSEFrame
  );

  revalidatePath(`/w/${ctx.workspaceSlug}/projects/${task.projectId}`);
  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${taskId}`);
  return { success: true, data: undefined };
}

export async function deleteTask(taskId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const taskProjectId = await getTaskProjectId(taskId);
  if (!taskProjectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(taskProjectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  const attachments = await prisma.attachment.findMany({
    where: { taskId },
    select: { storagePath: true },
  });

  const task = await prisma.task.delete({ where: { id: taskId } });

  await removeAttachmentObjects(attachments.map((a) => a.storagePath));

  eventBus.emit(`project:${task.projectId}`, {
    type: "task:deleted",
    _actorId: session.user.id,
    taskId,
  } as SSEFrame);

  revalidatePath(`/w/${ctx.workspaceSlug}/projects/${task.projectId}`);
  return { success: true, data: undefined };
}

export async function reorderTasks(
  projectId: string,
  status: TaskStatus,
  orderedIds: string[]
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  if (orderedIds.length === 0) return { success: true, data: undefined };
  if (orderedIds.length > 500) return { success: false, error: "Too many tasks" };

  const dedup = Array.from(new Set(orderedIds));
  if (dedup.length !== orderedIds.length) {
    return { success: false, error: "Duplicate task ids" };
  }

  const existing = await prisma.task.findMany({
    where: { id: { in: orderedIds }, projectId },
    select: { id: true },
  });
  if (existing.length !== orderedIds.length) {
    return { success: false, error: "Task ids do not all belong to this project" };
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.task.update({
        where: { id },
        data: { order: index, status },
      })
    )
  );

  eventBus.emit(`project:${projectId}`, {
    type: "task:reordered",
    _actorId: session.user.id,
    projectId,
    status,
    orderedIds,
  } as SSEFrame);

  revalidatePath(`/w/${ctx.workspaceSlug}/projects/${projectId}`);
  return { success: true, data: undefined };
}

export async function bulkUpdateTasks(
  projectId: string,
  taskIds: string[],
  updates: { status?: TaskStatus; priority?: string; assigneeId?: string | null }
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  if (taskIds.length === 0) return { success: false, error: "No tasks selected" };
  if (taskIds.length > 50) return { success: false, error: "Maximum 50 tasks at once" };

  await prisma.task.updateMany({
    where: { id: { in: taskIds }, projectId },
    data: {
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.priority !== undefined ? { priority: updates.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" } : {}),
      ...(updates.assigneeId !== undefined ? { assigneeId: updates.assigneeId || null } : {}),
    },
  });

  eventBus.emit(`project:${projectId}`, {
    type: "task:bulkUpdated",
    _actorId: session.user.id,
    taskIds,
    changes: updates,
  } as SSEFrame);

  revalidatePath(`/w/${ctx.workspaceSlug}/projects/${projectId}`);
  return { success: true, data: undefined };
}

export async function bulkDeleteTasks(projectId: string, taskIds: string[]) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  if (taskIds.length === 0) return { success: false, error: "No tasks selected" };
  if (taskIds.length > 50) return { success: false, error: "Maximum 50 tasks at once" };

  const attachments = await prisma.attachment.findMany({
    where: { taskId: { in: taskIds } },
    select: { storagePath: true },
  });

  await prisma.task.deleteMany({
    where: { id: { in: taskIds }, projectId },
  });

  await removeAttachmentObjects(attachments.map((a) => a.storagePath));

  eventBus.emit(`project:${projectId}`, {
    type: "task:bulkDeleted",
    _actorId: session.user.id,
    taskIds,
  } as SSEFrame);

  revalidatePath(`/w/${ctx.workspaceSlug}/projects/${projectId}`);
  return { success: true, data: undefined };
}

export async function addComment(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const taskId = formData.get("taskId") as string;
  const content = formData.get("content") as string;

  if (!content?.trim()) return { success: false, error: "Comment cannot be empty" };

  const commentProjectId = await getTaskProjectId(taskId);
  if (!commentProjectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(commentProjectId, session.user.id, ctx);
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
      workspaceId: ctx.workspaceId,
      userId: uid,
      type: "COMMENT_ADDED",
      title: "New Comment",
      message: `${session.user.name} commented on "${task?.title}"`,
      link: `/tasks/${taskId}`,
    });
  }

  if (notifyIds.size > 0 && task) {
    const [usersToEmail, project] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: [...notifyIds] } }, select: { email: true } }),
      prisma.project.findUnique({ where: { id: task.projectId }, select: { name: true } }),
    ]);
    for (const u of usersToEmail) {
      if (u.email) {
        await sendCommentEmail(u.email, session.user.name ?? "Someone", task.title, taskId, content.slice(0, 200), project?.name ?? "");
      }
    }
  }

  revalidatePath(`/w/${ctx.workspaceSlug}/projects/${task?.projectId}`);
  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${taskId}`);
  return { success: true, data: undefined };
}
