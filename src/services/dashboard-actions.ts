"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getDashboardStats() {
  const session = await auth();
  if (!session?.user) return null;

  const isAdmin = session.user.role === "ADMIN";
  const userId = session.user.id;

  const projectWhere = isAdmin
    ? {}
    : { members: { some: { userId } } };

  const [projectCount, taskStats, myTasks, recentActivity, activeSprints] =
    await Promise.all([
      prisma.project.count({ where: projectWhere }),

      prisma.task.groupBy({
        by: ["status"],
        where: isAdmin
          ? {}
          : { project: { members: { some: { userId } } } },
        _count: true,
      }),

      prisma.task.findMany({
        where: { assigneeId: userId, status: { not: "DONE" } },
        include: { project: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),

      prisma.activityLog.findMany({
        where: isAdmin
          ? {}
          : { project: { members: { some: { userId } } } },
        include: { user: true, project: true, task: true },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),

      prisma.sprint.findMany({
        where: {
          status: "ACTIVE",
          project: isAdmin ? {} : { members: { some: { userId } } },
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

  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}
