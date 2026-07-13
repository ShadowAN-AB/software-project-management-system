"use server";

import type { Session } from "next-auth";
import { auth, invalidateWorkspaceRoleCache } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDefaultWorkspace } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "crypto";
import type { ActionResult, WorkspaceContext } from "@/types";

async function requireAdmin(): Promise<{ session: Session; ctx: WorkspaceContext }> {
  const session = await auth();
  if (!session?.user) throw new Error("Admin access required");
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx || ctx.role !== "ADMIN") throw new Error("Admin access required");
  return { session, ctx };
}

export async function createInvitation(
  email: string,
  role: "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER" | "TESTER"
): Promise<ActionResult<{ token: string }>> {
  const { session, ctx } = await requireAdmin();

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { success: false, error: "Valid email is required" };
  }

  // Refuse if the target is already a member of THIS workspace.
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      workspaceMemberships: {
        where: { workspaceId: ctx.workspaceId },
        select: { id: true },
      },
    },
  });
  if (existingUser?.workspaceMemberships.length) {
    return { success: false, error: "This user is already a member of this workspace" };
  }

  // Refuse if a live invite for THIS email + THIS workspace already exists.
  const existingInvite = await prisma.invitation.findFirst({
    where: {
      email: normalizedEmail,
      workspaceId: ctx.workspaceId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (existingInvite) {
    return { success: false, error: "A pending invitation already exists for this email" };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.invitation.create({
    data: {
      email: normalizedEmail,
      role,
      token,
      expiresAt,
      invitedById: session.user.id,
      workspaceId: ctx.workspaceId,
    },
  });

  revalidatePath(`/w/${ctx.workspaceSlug}/admin`);
  return { success: true, data: { token } };
}

/**
 * Admin-panel view of THIS workspace's outgoing invitations.
 */
export async function getInvitations() {
  const { ctx } = await requireAdmin();

  return prisma.invitation.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { invitedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const { ctx } = await requireAdmin();

  // Scope the delete to this workspace so an admin of workspace A can't
  // revoke invitations owned by workspace B.
  const invitation = await prisma.invitation.findUnique({
    where: { id },
    select: { workspaceId: true },
  });
  if (!invitation || invitation.workspaceId !== ctx.workspaceId) {
    return { success: false, error: "Invitation not found" };
  }

  await prisma.invitation.delete({ where: { id } });

  revalidatePath(`/w/${ctx.workspaceSlug}/admin`);
  return { success: true, data: undefined };
}

/**
 * Public read for the invite-landing / register flow.
 * Returns the invited workspace summary alongside the invite so the UI
 * can tell the user which workspace they're being asked to join.
 */
export async function validateInviteToken(token: string) {
  if (!token) return null;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { name: true } },
    },
  });

  if (!invitation) return null;
  if (invitation.usedAt) return null;
  if (invitation.expiresAt < new Date()) return null;

  return {
    email: invitation.email,
    role: invitation.role,
    token: invitation.token,
    workspace: invitation.workspace,
    invitedBy: invitation.invitedBy,
    expiresAt: invitation.expiresAt,
  };
}

/**
 * Pending invitations for the currently-signed-in user's email address.
 * Used by the /invitations page and the switcher badge.
 */
export async function getMyPendingInvitations() {
  const session = await auth();
  if (!session?.user?.email) return [];

  return prisma.invitation.findMany({
    where: {
      email: session.user.email.toLowerCase(),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      workspace: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function countMyPendingInvitations(): Promise<number> {
  const session = await auth();
  if (!session?.user?.email) return 0;

  return prisma.invitation.count({
    where: {
      email: session.user.email.toLowerCase(),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}

/**
 * Logged-in user accepts an invitation. Adds them to the workspace, marks
 * the invite used, and redirects to the workspace dashboard. Server actions
 * that redirect() throw NEXT_REDIRECT — do not swallow.
 */
export async function acceptInvitation(token: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: "Sign in first" };
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { workspace: { select: { id: true, slug: true } } },
  });
  if (!invitation) return { success: false, error: "Invalid invitation" };
  if (invitation.usedAt) return { success: false, error: "Invitation already used" };
  if (invitation.expiresAt < new Date()) {
    return { success: false, error: "Invitation expired" };
  }
  if (invitation.email !== session.user.email.toLowerCase()) {
    return { success: false, error: "This invitation was sent to a different email address" };
  }

  const existingMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: invitation.workspaceId,
        userId: session.user.id,
      },
    },
    select: { id: true },
  });

  // If the user is somehow already a member, still mark the invite used so
  // the switcher badge clears.
  await prisma.$transaction([
    ...(existingMembership
      ? []
      : [
          prisma.workspaceMember.create({
            data: {
              workspaceId: invitation.workspaceId,
              userId: session.user.id,
              role: invitation.role,
            },
          }),
        ]),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    }),
  ]);
  invalidateWorkspaceRoleCache(session.user.id, invitation.workspaceId);

  revalidatePath("/invitations");
  redirect(`/w/${invitation.workspace.slug}/dashboard`);
}

/**
 * Logged-in user declines a pending invitation addressed to them.
 * Only removes the invitation record — doesn't touch any memberships.
 */
export async function declineInvitation(token: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "Sign in first" };

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: { id: true, email: true, usedAt: true },
  });
  if (!invitation) return { success: false, error: "Invalid invitation" };
  if (invitation.email !== session.user.email.toLowerCase()) {
    return { success: false, error: "Not your invitation" };
  }
  if (invitation.usedAt) {
    return { success: false, error: "Already used" };
  }

  await prisma.invitation.delete({ where: { id: invitation.id } });

  revalidatePath("/invitations");
  return { success: true, data: undefined };
}
