"use server";

import { prisma } from "@/lib/prisma";

export async function getProjectOverview(projectId: string) {
  const [project, taskStats, sprintStats, recentActivity] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { include: { user: true } },
        _count: { select: { tasks: true } },
      },
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: { projectId },
      _count: true,
    }),
    prisma.sprint.findMany({
      where: { projectId },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          select: { status: true },
        },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.activityLog.findMany({
      where: { projectId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  if (!project) return null;

  const statusCounts: Record<string, number> = {};
  for (const s of taskStats) {
    statusCounts[s.status] = s._count;
  }

  const totalTasks = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const doneTasks = statusCounts["DONE"] ?? 0;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Per-member task distribution
  const memberTasks = await prisma.task.groupBy({
    by: ["assigneeId"],
    where: { projectId, assigneeId: { not: null } },
    _count: true,
  });

  const memberTaskMap: Record<string, number> = {};
  for (const mt of memberTasks) {
    if (mt.assigneeId) memberTaskMap[mt.assigneeId] = mt._count;
  }

  // Overdue count
  const overdueCount = await prisma.task.count({
    where: {
      projectId,
      status: { notIn: ["DONE"] },
      dueDate: { lt: new Date() },
    },
  });

  return {
    project,
    statusCounts,
    totalTasks,
    doneTasks,
    progress,
    sprints: sprintStats,
    recentActivity,
    memberTaskMap,
    overdueCount,
  };
}

export async function getTeamWorkload() {
  const users = await prisma.user.findMany({
    include: {
      assignedTasks: {
        where: { status: { notIn: ["DONE"] } },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          project: { select: { name: true, key: true } },
        },
      },
      projectMemberships: {
        include: { project: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get completed tasks count per user this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const completedThisWeek = await prisma.task.groupBy({
    by: ["assigneeId"],
    where: {
      status: "DONE",
      updatedAt: { gte: weekAgo },
      assigneeId: { not: null },
    },
    _count: true,
  });

  const completedMap: Record<string, number> = {};
  for (const c of completedThisWeek) {
    if (c.assigneeId) completedMap[c.assigneeId] = c._count;
  }

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    activeTasks: user.assignedTasks,
    activeTaskCount: user.assignedTasks.length,
    completedThisWeek: completedMap[user.id] ?? 0,
    projects: user.projectMemberships.map((pm) => pm.project),
    tasksByPriority: {
      CRITICAL: user.assignedTasks.filter((t) => t.priority === "CRITICAL").length,
      HIGH: user.assignedTasks.filter((t) => t.priority === "HIGH").length,
      MEDIUM: user.assignedTasks.filter((t) => t.priority === "MEDIUM").length,
      LOW: user.assignedTasks.filter((t) => t.priority === "LOW").length,
    },
    overdueTasks: user.assignedTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < new Date()
    ).length,
  }));
}
