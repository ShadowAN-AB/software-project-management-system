"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sprintSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/types";
import type { SprintStatus } from "@prisma/client";

export async function getSprintsByProject(projectId: string) {
  return prisma.sprint.findMany({
    where: { projectId },
    include: {
      tasks: { include: { assignee: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function getSprint(id: string) {
  return prisma.sprint.findUnique({
    where: { id },
    include: {
      project: true,
      tasks: {
        include: { assignee: true, creator: true },
        orderBy: [{ status: "asc" }, { order: "asc" }],
      },
    },
  });
}

export async function createSprint(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!["ADMIN", "PROJECT_MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Only admins and PMs can create sprints" };
  }

  const parsed = sprintSchema.safeParse({
    name: formData.get("name"),
    goal: formData.get("goal"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    projectId: formData.get("projectId"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const sprint = await prisma.sprint.create({
    data: {
      name: parsed.data.name,
      goal: parsed.data.goal || null,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      projectId: parsed.data.projectId,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "SPRINT_CREATED",
      details: `Created sprint "${sprint.name}"`,
      userId: session.user.id,
      projectId: parsed.data.projectId,
    },
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
  redirect(`/sprints/${sprint.id}`);
}

export async function updateSprintStatus(sprintId: string, status: SprintStatus) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const sprint = await prisma.sprint.update({
    where: { id: sprintId },
    data: { status },
  });

  if (status === "COMPLETED") {
    await prisma.task.updateMany({
      where: { sprintId, status: { not: "DONE" } },
      data: { sprintId: null },
    });
  }

  revalidatePath(`/sprints/${sprintId}`);
  revalidatePath(`/projects/${sprint.projectId}`);
  return { success: true, data: undefined };
}

export async function assignTaskToSprint(taskId: string, sprintId: string | null) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { sprintId },
  });

  revalidatePath(`/projects/${task.projectId}`);
  if (sprintId) revalidatePath(`/sprints/${sprintId}`);
  return { success: true, data: undefined };
}
