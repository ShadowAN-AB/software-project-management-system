"use server";

import { signIn } from "@/lib/auth";
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
    redirect("/dashboard");
  }
  return { success: false, error: "Something went wrong" };
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

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existing) {
    return { success: false, error: "Email already registered" };
  }

  const userCount = await prisma.user.count();
  const isFirstUser = userCount === 0;

  // After the first user, registration requires a valid invite token
  const token = formData.get("token") as string | null;
  let inviteRole: string | null = null;

  if (!isFirstUser) {
    if (!token) {
      return { success: false, error: "Registration requires an invitation. Contact your admin." };
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
      return { success: false, error: "Invalid or expired invitation link" };
    }

    if (invitation.email !== parsed.data.email) {
      return { success: false, error: "This invitation was sent to a different email address" };
    }

    inviteRole = invitation.role;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const role = isFirstUser ? "ADMIN" : (inviteRole ?? "DEVELOPER");

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: role as "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER" | "TESTER",
    },
  });

  // Mark invitation as used
  if (token) {
    await prisma.invitation.update({
      where: { token },
      data: { usedAt: new Date() },
    });
  }

  redirect("/login?registered=true");
}

export async function getSystemHasUsers() {
  const count = await prisma.user.count();
  return count > 0;
}
