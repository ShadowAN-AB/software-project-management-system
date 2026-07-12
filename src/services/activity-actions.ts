"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDefaultWorkspace } from "@/lib/authorization";

export async function getActivityFeed(options?: {
  projectId?: string;
  limit?: number;
  offset?: number;
}) {
  const session = await auth();
  if (!session?.user) return [];
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return [];

  const isAdmin = ctx.role === "ADMIN";
  const userId = session.user.id;
  const limit = options?.limit ?? 30;
  const offset = options?.offset ?? 0;

  const workspaceScope = isAdmin
    ? { workspaceId: ctx.workspaceId }
    : { workspaceId: ctx.workspaceId, members: { some: { userId } } };

  return prisma.activityLog.findMany({
    where: {
      ...(options?.projectId ? { projectId: options.projectId } : {}),
      project: workspaceScope,
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
