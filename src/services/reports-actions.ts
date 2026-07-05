"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getReportsData() {
  const session = await auth();
  if (!session?.user) return null;

  const isAdmin = session.user.role === "ADMIN";
  const userId = session.user.id;
  const projectWhere = isAdmin ? {} : { members: { some: { userId } } };
  const taskWhere = isAdmin ? {} : { project: { members: { some: { userId } } } };

  const [
    tasksByStatus,
    tasksByPriority,
    tasksByType,
    projectsByStatus,
    tasksTrend,
    topAssignees,
    sprintStats,
    overdueTasks,
  ] = await Promise.all([
    // Tasks by status
    prisma.task.groupBy({
      by: ["status"],
      where: taskWhere,
      _count: true,
    }),

    // Tasks by priority
    prisma.task.groupBy({
      by: ["priority"],
      where: taskWhere,
      _count: true,
    }),

    // Tasks by type
    prisma.task.groupBy({
      by: ["type"],
      where: taskWhere,
      _count: true,
    }),

    // Projects by status
    prisma.project.groupBy({
      by: ["status"],
      where: projectWhere,
      _count: true,
    }),

    // Tasks created in last 30 days (grouped by day)
    prisma.task.findMany({
      where: {
        ...taskWhere,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: "asc" },
    }),

    // Top assignees by task count
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: { ...taskWhere, assigneeId: { not: null } },
      _count: true,
      orderBy: { _count: { assigneeId: "desc" } },
      take: 5,
    }),

    // Sprint completion rates
    prisma.sprint.findMany({
      where: {
        status: { in: ["ACTIVE", "COMPLETED"] },
        project: isAdmin ? {} : { members: { some: { userId } } },
      },
      include: {
        project: { select: { name: true } },
        _count: { select: { tasks: true } },
        tasks: {
          where: { status: "DONE" },
          select: { id: true },
        },
      },
      orderBy: { startDate: "desc" },
      take: 10,
    }),

    // Overdue tasks
    prisma.task.count({
      where: {
        ...taskWhere,
        dueDate: { lt: new Date() },
        status: { not: "DONE" },
      },
    }),
  ]);

  // Resolve assignee names
  const assigneeIds = topAssignees
    .map((a) => a.assigneeId)
    .filter((id): id is string => id !== null);

  const assigneeUsers = await prisma.user.findMany({
    where: { id: { in: assigneeIds } },
    select: { id: true, name: true },
  });

  const assigneeMap = Object.fromEntries(assigneeUsers.map((u) => [u.id, u.name]));

  // Group tasks by day for trend
  const dailyMap = new Map<string, { created: number; completed: number }>();
  for (const t of tasksTrend) {
    const day = t.createdAt.toISOString().slice(0, 10);
    const entry = dailyMap.get(day) ?? { created: 0, completed: 0 };
    entry.created++;
    if (t.status === "DONE") entry.completed++;
    dailyMap.set(day, entry);
  }

  return {
    tasksByStatus: Object.fromEntries(tasksByStatus.map((s) => [s.status, s._count])),
    tasksByPriority: Object.fromEntries(tasksByPriority.map((p) => [p.priority, p._count])),
    tasksByType: Object.fromEntries(tasksByType.map((t) => [t.type, t._count])),
    projectsByStatus: Object.fromEntries(projectsByStatus.map((p) => [p.status, p._count])),
    dailyTrend: Array.from(dailyMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    })),
    topAssignees: topAssignees.map((a) => ({
      name: assigneeMap[a.assigneeId!] ?? "Unknown",
      count: a._count,
    })),
    sprintStats: sprintStats.map((s) => ({
      name: s.name,
      project: s.project.name,
      total: s._count.tasks,
      completed: s.tasks.length,
      status: s.status,
    })),
    overdueTasks,
  };
}
