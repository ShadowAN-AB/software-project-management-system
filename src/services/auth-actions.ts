"use server";

import { signIn, invalidateWorkspaceRoleCache } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/types";

export async function login(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let success = false;
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
    success = true;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return { success: false, error: "Invalid email or password" };
  }
  if (success) {
    // Root page redirects to the user's workspace after login.
    redirect("/");
  }
  return { success: false, error: "Something went wrong" };
}

/**
 * Kebab-case slug from a display name. Falls back to "workspace".
 */
function sanitizeSlug(base: string): string {
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "workspace";
}

async function pickUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let suffix = 2;
  // Retry with -2, -3, ... on unique conflict.
  while (await prisma.workspace.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 999) throw new Error("Could not find a unique workspace slug");
  }
  return candidate;
}

export async function register(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const token = (formData.get("token") as string | null)?.trim() || null;

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { success: false, error: "Email already registered" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  // If the caller carried a live invite token for this email, register them
  // into the inviting workspace as a member with the invited role — NOT as
  // the admin of a brand-new workspace.
  if (token) {
    const invite = await prisma.invitation.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        role: true,
        workspaceId: true,
        usedAt: true,
        expiresAt: true,
      },
    });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return { success: false, error: "Invalid or expired invitation link" };
    }
    if (invite.email !== normalizedEmail) {
      return {
        success: false,
        error: "This invitation was sent to a different email address",
      };
    }

    const newUserId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: normalizedEmail,
          passwordHash,
        },
      });
      await tx.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: invite.workspaceId,
          role: invite.role,
        },
      });
      await tx.invitation.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
      return user.id;
    });
    invalidateWorkspaceRoleCache(newUserId, invite.workspaceId);
    redirect("/login?registered=true");
  }

  // No token → public signup path. New user gets their own workspace as ADMIN.
  const firstName = parsed.data.name.split(/\s+/)[0] ?? parsed.data.name;
  const workspaceName = `${firstName}'s Workspace`;
  const slugBase = sanitizeSlug(`${firstName}s-workspace`);
  const slug = await pickUniqueSlug(slugBase);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: parsed.data.name,
        email: normalizedEmail,
        passwordHash,
      },
    });
    const workspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        slug,
        createdById: user.id,
      },
    });
    await tx.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: "ADMIN",
      },
    });
  });

  redirect("/login?registered=true");
}
