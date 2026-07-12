"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/authorization";

export async function getProjectOverview(projectId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const isMember = await requireProjectMember(projectId, session.user.id, session.user.role);
  if (!isMember) return null;

  const [project, taskStats, sprintStats, recentActivity, memberTasks, overdueCount] =
    await Promise.all([
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
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: { projectId, assigneeId: { not: null } },
        _count: true,
      }),
      prisma.task.count({
        where: {
          projectId,
          status: { not: "DONE" },
          dueDate: { lt: new Date() },
        },
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

  const memberTaskMap: Record<string, number> = {};
  for (const mt of memberTasks) {
    if (mt.assigneeId) memberTaskMap[mt.assigneeId] = mt._count;
  }

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
  const session = await auth();
  if (!session?.user) return [];

  let projectScope: { projectId: { in: string[] } } | Record<string, never>;
  if (session.user.role === "ADMIN") {
    projectScope = {};
  } else {
    const userProjects = await prisma.projectMember.findMany({
      where: { userId: session.user.id },
      select: { projectId: true },
    });
    projectScope = { projectId: { in: userProjects.map((p) => p.projectId) } };
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [users, completedThisWeek] = await Promise.all([
    prisma.user.findMany({
      where: "projectId" in projectScope
        ? { projectMemberships: { some: projectScope } }
        : {},
      include: {
        assignedTasks: {
          where: { status: { not: "DONE" }, ...projectScope },
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
          where: "projectId" in projectScope ? projectScope : undefined,
          include: { project: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        status: "DONE",
        updatedAt: { gte: weekAgo },
        assigneeId: { not: null },
        ...projectScope,
      },
      _count: true,
    }),
  ]);

  const completedMap: Record<string, number> = {};
  for (const c of completedThisWeek) {
    if (c.assigneeId) completedMap[c.assigneeId] = c._count;
  }

  const now = new Date();
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
      (t) => t.dueDate && new Date(t.dueDate) < now
    ).length,
  }));
}
