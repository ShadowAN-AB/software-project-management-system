"use server";

import type { Session } from "next-auth";
import { auth, invalidateWorkspaceRoleCache, invalidateAllWorkspaceRolesForUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDefaultWorkspace } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import type { ActionResult, WorkspaceContext } from "@/types";

async function requireAdmin(): Promise<{ session: Session; ctx: WorkspaceContext }> {
  const session = await auth();
  if (!session?.user) throw new Error("Admin access required");
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx || ctx.role !== "ADMIN") throw new Error("Admin access required");
  return { session, ctx };
}

export async function getAdminStats() {
  const { ctx } = await requireAdmin();

  const [memberCount, projectCount, taskCount, recentMembers, roleGroups] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.project.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.task.count({ where: { project: { workspaceId: ctx.workspaceId } } }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { joinedAt: "desc" },
      take: 5,
      select: {
        role: true,
        joinedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.workspaceMember.groupBy({
      by: ["role"],
      where: { workspaceId: ctx.workspaceId },
      _count: true,
    }),
  ]);

  return {
    userCount: memberCount,
    projectCount,
    taskCount,
    recentUsers: recentMembers.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      createdAt: m.joinedAt,
    })),
    roleDistribution: Object.fromEntries(roleGroups.map((r) => [r.role, r._count])),
  };
}

export async function getAdminUsers() {
  const { ctx } = await requireAdmin();

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { joinedAt: "desc" },
    include: {
      user: {
        include: {
          _count: {
            select: {
              assignedTasks: true,
              createdTasks: true,
              projectMemberships: true,
            },
          },
        },
      },
    },
  });

  return members.map((m) => ({
    ...m.user,
    role: m.role,
  }));
}

export async function updateUserRole(
  userId: string,
  role: "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER" | "TESTER"
): Promise<ActionResult> {
  const { session, ctx } = await requireAdmin();

  if (userId === session.user.id) {
    return { success: false, error: "Cannot change your own role" };
  }

  await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId } },
    data: { role },
  });
  invalidateWorkspaceRoleCache(userId, ctx.workspaceId);

  revalidatePath(`/w/${ctx.workspaceSlug}/admin`);
  return { success: true, data: undefined };
}

export async function getAdminCount() {
  return prisma.workspaceMember.count({ where: { role: "ADMIN" } });
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const { session, ctx } = await requireAdmin();

  if (userId === session.user.id) {
    return { success: false, error: "Cannot delete your own account" };
  }

  await prisma.$transaction([
    prisma.task.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } }),
    prisma.task.updateMany({ where: { creatorId: userId }, data: { creatorId: null } }),
    prisma.projectMember.deleteMany({ where: { userId } }),
    prisma.workspaceMember.deleteMany({ where: { userId } }),
    prisma.comment.deleteMany({ where: { userId } }),
    prisma.activityLog.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  invalidateAllWorkspaceRolesForUser(userId);

  revalidatePath(`/w/${ctx.workspaceSlug}/admin`);
  return { success: true, data: undefined };
}
