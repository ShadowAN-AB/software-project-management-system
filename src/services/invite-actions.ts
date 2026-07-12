"use server";

import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDefaultWorkspace } from "@/lib/authorization";
import { revalidatePath } from "next/cache";
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

  if (!email || !email.includes("@")) {
    return { success: false, error: "Valid email is required" };
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { success: false, error: "A user with this email already exists" };
  }

  try {
    // Check for existing pending invite
    const existingInvite = await prisma.invitation.findFirst({
      where: { email, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (existingInvite) {
      return { success: false, error: "A pending invitation already exists for this email" };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.invitation.create({
      data: {
        email,
        role,
        token,
        expiresAt,
        invitedById: session.user.id,
        workspaceId: ctx.workspaceId,
      },
    });

    revalidatePath(`/w/${ctx.workspaceSlug}/admin`);
    return { success: true, data: { token } };
  } catch {
    return { success: false, error: "Invite system not ready. Run: npx prisma db push" };
  }
}

export async function getInvitations() {
  await requireAdmin();

  try {
    return await prisma.invitation.findMany({
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    // Table may not exist yet — return empty array so admin page still loads
    return [];
  }
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const { ctx } = await requireAdmin();

  await prisma.invitation.delete({ where: { id } });

  revalidatePath(`/w/${ctx.workspaceSlug}/admin`);
  return { success: true, data: undefined };
}

export async function validateInviteToken(token: string) {
  if (!token) return null;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) return null;
  if (invitation.usedAt) return null;
  if (invitation.expiresAt < new Date()) return null;

  return {
    email: invitation.email,
    role: invitation.role,
    token: invitation.token,
  };
}
