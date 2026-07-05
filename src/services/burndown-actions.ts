"use server";

import { prisma } from "@/lib/prisma";
import { eachDayOfInterval, startOfDay, isBefore, isAfter } from "date-fns";

export type BurndownPoint = {
  date: string;
  ideal: number;
  actual: number | null;
};

export async function getBurndownData(sprintId: string): Promise<BurndownPoint[]> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      tasks: {
        select: { id: true, status: true, updatedAt: true },
      },
    },
  });

  if (!sprint) return [];

  const totalTasks = sprint.tasks.length;
  if (totalTasks === 0) return [];

  const start = startOfDay(new Date(sprint.startDate));
  const end = startOfDay(new Date(sprint.endDate));
  const today = startOfDay(new Date());

  const days = eachDayOfInterval({ start, end });
  const totalDays = days.length - 1; // exclude start day for calculation

  // Get activity logs for task completions within this sprint
  const taskIds = sprint.tasks.map((t) => t.id);
  const completionLogs = await prisma.activityLog.findMany({
    where: {
      taskId: { in: taskIds },
      action: "TASK_STATUS_CHANGED",
      details: { contains: "DONE" },
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: "asc" },
  });

  // Build a map of date → cumulative tasks completed by that date
  const completionsByDate = new Map<string, number>();
  let cumulativeCompleted = 0;

  for (const log of completionLogs) {
    const dateKey = startOfDay(new Date(log.createdAt)).toISOString();
    cumulativeCompleted++;
    completionsByDate.set(dateKey, cumulativeCompleted);
  }

  // Generate burndown points
  let lastKnownCompleted = 0;
  return days.map((day, i) => {
    const dateKey = day.toISOString();
    const dateStr = day.toISOString().split("T")[0];

    // Ideal: linear from totalTasks to 0
    const ideal = totalDays > 0
      ? Math.round((totalTasks - (totalTasks * i) / totalDays) * 10) / 10
      : 0;

    // Actual: remaining tasks (total - completed by this date)
    const completed = completionsByDate.get(dateKey) ?? lastKnownCompleted;
    lastKnownCompleted = completed;

    const isFuture = isAfter(day, today);
    const actual = isFuture ? null : totalTasks - completed;

    return { date: dateStr, ideal, actual };
  });
}
