"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Admin access required");
  }
  return session;
}

export async function getAdminStats() {
  await requireAdmin();

  const [userCount, projectCount, taskCount, recentUsers] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.task.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
  ]);

  const roleDistribution = await prisma.user.groupBy({
    by: ["role"],
    _count: true,
  });

  return {
    userCount,
    projectCount,
    taskCount,
    recentUsers,
    roleDistribution: Object.fromEntries(
      roleDistribution.map((r) => [r.role, r._count])
    ),
  };
}

export async function getAdminUsers() {
  await requireAdmin();

  return prisma.user.findMany({
    include: {
      _count: {
        select: {
          assignedTasks: true,
          createdTasks: true,
          projectMemberships: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateUserRole(
  userId: string,
  role: "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER" | "TESTER"
): Promise<ActionResult> {
  const session = await requireAdmin();

  if (userId === session.user.id) {
    return { success: false, error: "Cannot change your own role" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  revalidatePath("/admin");
  return { success: true, data: undefined };
}

export async function bootstrapAdmin(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  // Only works when zero admins exist in the system
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount > 0) {
    return { success: false, error: "An admin already exists. Contact them for role changes." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { role: "ADMIN" },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export async function getAdminCount() {
  return prisma.user.count({ where: { role: "ADMIN" } });
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const session = await requireAdmin();

  if (userId === session.user.id) {
    return { success: false, error: "Cannot delete your own account" };
  }

  // Check if user has assignments
  const taskCount = await prisma.task.count({
    where: { assigneeId: userId },
  });

  if (taskCount > 0) {
    // Unassign tasks first
    await prisma.task.updateMany({
      where: { assigneeId: userId },
      data: { assigneeId: null },
    });
  }

  // Remove memberships, then comments, then activity logs, then user
  await prisma.$transaction([
    prisma.projectMember.deleteMany({ where: { userId } }),
    prisma.comment.deleteMany({ where: { userId } }),
    prisma.activityLog.deleteMany({ where: { userId } }),
    prisma.task.updateMany({ where: { creatorId: userId }, data: { creatorId: null } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  revalidatePath("/admin");
  return { success: true, data: undefined };
}
