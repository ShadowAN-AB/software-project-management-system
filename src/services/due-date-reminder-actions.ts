"use server";

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/services/notification-actions";

export async function checkDueDateReminders() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowEnd = new Date(todayStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 2);

  // Find overdue tasks (due before today, not done, assigned)
  const overdueTasks = await prisma.task.findMany({
    where: {
      dueDate: { lt: todayStart },
      status: { not: "DONE" },
      assigneeId: { not: null },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      assigneeId: true,
      project: { select: { key: true } },
    },
  });

  // Find tasks due within the next 24 hours (due today or tomorrow, not done, assigned)
  const dueSoonTasks = await prisma.task.findMany({
    where: {
      dueDate: { gte: todayStart, lt: tomorrowEnd },
      status: { not: "DONE" },
      assigneeId: { not: null },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      assigneeId: true,
      project: { select: { key: true } },
    },
  });

  // Check for existing recent notifications to avoid duplicates.
  // Only send one overdue/due-soon notification per task per day.
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const allTaskIds = [
    ...overdueTasks.map((t) => t.id),
    ...dueSoonTasks.map((t) => t.id),
  ];

  if (allTaskIds.length === 0) return { sent: 0 };

  const recentNotifications = await prisma.notification.findMany({
    where: {
      type: { in: ["TASK_OVERDUE", "TASK_DUE_SOON"] },
      link: { in: allTaskIds.map((id) => `/tasks/${id}`) },
      createdAt: { gte: oneDayAgo },
    },
    select: { link: true, type: true },
  });

  const recentSet = new Set(
    recentNotifications.map((n) => `${n.type}:${n.link}`)
  );

  let sent = 0;

  for (const task of overdueTasks) {
    const key = `TASK_OVERDUE:/tasks/${task.id}`;
    if (recentSet.has(key)) continue;

    const daysOverdue = Math.floor(
      (todayStart.getTime() - new Date(task.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
    );

    await createNotification({
      userId: task.assigneeId!,
      type: "TASK_OVERDUE",
      title: "Task Overdue",
      message: `"${task.title}" is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`,
      link: `/tasks/${task.id}`,
    });
    sent++;
  }

  for (const task of dueSoonTasks) {
    const key = `TASK_DUE_SOON:/tasks/${task.id}`;
    if (recentSet.has(key)) continue;

    const dueDate = new Date(task.dueDate!);
    const isToday = dueDate.toDateString() === now.toDateString();

    await createNotification({
      userId: task.assigneeId!,
      type: "TASK_DUE_SOON",
      title: isToday ? "Task Due Today" : "Task Due Tomorrow",
      message: `"${task.title}" is due ${isToday ? "today" : "tomorrow"}`,
      link: `/tasks/${task.id}`,
    });
    sent++;
  }

  return { sent };
}
