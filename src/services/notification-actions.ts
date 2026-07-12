"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { NotificationType } from "@prisma/client";
import { eventBus } from "@/lib/event-bus";
import type { SSEFrame } from "@/lib/sse-events";

export async function getNotifications() {
  const session = await auth();
  if (!session?.user) return [];

  return prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getUnreadCount() {
  const session = await auth();
  if (!session?.user) return 0;

  return prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });
}

export async function markAsRead(notificationId: string) {
  const session = await auth();
  if (!session?.user) return;

  await prisma.notification.update({
    where: { id: notificationId, userId: session.user.id },
    data: { read: true },
  });

  revalidatePath("/", "layout");
}

export async function markAllAsRead() {
  const session = await auth();
  if (!session?.user) return;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  revalidatePath("/", "layout");
}

// Helper to create notifications — called from other server actions
export async function createNotification({
  userId,
  workspaceId,
  type,
  title,
  message,
  link,
}: {
  userId: string;
  workspaceId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const notification = await prisma.notification.create({
    data: { userId, workspaceId, type, title, message, link },
  });

  eventBus.emit(`user:${userId}`, {
    type: "notification:created",
    _actorId: userId,
    notification: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: notification.read,
      link: notification.link,
      createdAt: notification.createdAt.toISOString(),
    },
  } as SSEFrame);
}

// Notify multiple users
export async function notifyUsers({
  userIds,
  workspaceId,
  type,
  title,
  message,
  link,
  excludeUserId,
}: {
  userIds: string[];
  workspaceId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  excludeUserId?: string;
}) {
  const targets = excludeUserId
    ? userIds.filter((id) => id !== excludeUserId)
    : userIds;

  if (targets.length === 0) return;

  for (const targetId of targets) {
    await createNotification({ userId: targetId, workspaceId, type, title, message, link });
  }
}
