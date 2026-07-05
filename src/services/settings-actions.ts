"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";
import bcrypt from "bcryptjs";

export async function getProfile() {
  const session = await auth();
  if (!session?.user) return null;

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
    },
  });
}

export async function updateProfile(data: {
  name: string;
  email: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!data.name?.trim()) return { success: false, error: "Name is required" };
  if (!data.email?.trim()) return { success: false, error: "Email is required" };

  const normalizedEmail = data.email.trim().toLowerCase();

  // Check if email is taken by another user (case-insensitive)
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" }, NOT: { id: session.user.id } },
  });
  if (existing) return { success: false, error: "Email already in use" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: data.name.trim(), email: normalizedEmail },
  });

  revalidatePath("/", "layout");
  return { success: true, data: undefined };
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (!data.currentPassword) return { success: false, error: "Current password is required" };
  if (!data.newPassword || data.newPassword.length < 6) {
    return { success: false, error: "New password must be at least 6 characters" };
  }
  if (data.newPassword !== data.confirmPassword) {
    return { success: false, error: "Passwords do not match" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user) return { success: false, error: "User not found" };

  const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!valid) return { success: false, error: "Current password is incorrect" };

  const passwordHash = await bcrypt.hash(data.newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return { success: true, data: undefined };
}
