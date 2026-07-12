"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDefaultWorkspace } from "@/lib/authorization";

export async function getDashboardStats() {
  const session = await auth();
  if (!session?.user) return null;
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return null;

  const isAdmin = ctx.role === "ADMIN";
  const userId = session.user.id;
  const workspaceId = ctx.workspaceId;

  // Admin sees every project in the current workspace; non-admin sees only
  // projects they explicitly belong to (still workspace-scoped).
  const projectWhere = isAdmin
    ? { workspaceId }
    : { workspaceId, members: { some: { userId } } };
  const projectFilter = isAdmin
    ? { workspaceId }
    : { workspaceId, members: { some: { userId } } };

  const [projectCount, taskStats, myTasks, recentActivity, activeSprints] =
    await Promise.all([
      prisma.project.count({ where: projectWhere }),

      prisma.task.groupBy({
        by: ["status"],
        where: { project: projectFilter },
        _count: true,
      }),

      prisma.task.findMany({
        where: {
          assigneeId: userId,
          status: { not: "DONE" },
          project: { workspaceId },
        },
        include: { project: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),

      prisma.activityLog.findMany({
        where: { project: projectFilter },
        include: { user: true, project: true, task: true },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),

      prisma.sprint.findMany({
        where: {
          status: "ACTIVE",
          project: projectFilter,
        },
        include: {
          project: true,
          _count: { select: { tasks: true } },
          tasks: { where: { status: "DONE" }, select: { id: true } },
        },
        take: 5,
      }),
    ]);

  const statusMap = Object.fromEntries(
    taskStats.map((s) => [s.status, s._count])
  );

  return {
    projectCount,
    totalTasks:
      (statusMap.BACKLOG ?? 0) +
      (statusMap.TODO ?? 0) +
      (statusMap.IN_PROGRESS ?? 0) +
      (statusMap.IN_REVIEW ?? 0) +
      (statusMap.DONE ?? 0),
    tasksByStatus: statusMap,
    myTasks,
    recentActivity,
    activeSprints: activeSprints.map((s) => ({
      ...s,
      completedTasks: s.tasks.length,
    })),
  };
}

export async function getAllUsers() {
  const session = await auth();
  if (!session?.user) return [];
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return [];

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
  }));
}
