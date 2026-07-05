"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getActivityFeed(options?: {
  projectId?: string;
  limit?: number;
  offset?: number;
}) {
  const session = await auth();
  if (!session?.user) return [];

  const isAdmin = session.user.role === "ADMIN";
  const userId = session.user.id;
  const limit = options?.limit ?? 30;
  const offset = options?.offset ?? 0;

  return prisma.activityLog.findMany({
    where: {
      ...(options?.projectId ? { projectId: options.projectId } : {}),
      ...(isAdmin ? {} : { project: { members: { some: { userId } } } }),
    },
    include: {
      user: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, key: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}
