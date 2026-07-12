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

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existing) {
    return { success: false, error: "Email already registered" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const firstName = parsed.data.name.split(/\s+/)[0] ?? parsed.data.name;
  const workspaceName = `${firstName}'s Workspace`;
  const slugBase = sanitizeSlug(`${firstName}s-workspace`);
  const slug = await pickUniqueSlug(slugBase);

  // Atomic: user + workspace + ADMIN membership either all persist or none.
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
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
