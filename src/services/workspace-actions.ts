"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateWorkspaceRoleCache } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/types";

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
  while (
    await prisma.workspace.findUnique({ where: { slug: candidate }, select: { id: true } })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 999) throw new Error("Could not find a unique workspace slug");
  }
  return candidate;
}

export async function createWorkspace(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const rawName = (formData.get("name") as string | null)?.trim() ?? "";
  if (rawName.length < 2 || rawName.length > 60) {
    return { success: false, error: "Workspace name must be 2–60 characters" };
  }

  const slug = await pickUniqueSlug(sanitizeSlug(rawName));

  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        name: rawName,
        slug,
        createdById: session.user.id,
      },
    });
    await tx.workspaceMember.create({
      data: {
        userId: session.user.id,
        workspaceId: ws.id,
        role: "ADMIN",
      },
    });
    return ws;
  });
  invalidateWorkspaceRoleCache(session.user.id, workspace.id);

  const jar = await cookies();
  jar.set("lastWorkspaceSlug", workspace.slug, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });

  redirect(`/w/${workspace.slug}/dashboard`);
}

export async function listMyWorkspaces() {
  const session = await auth();
  if (!session?.user) return [];

  const members = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: { workspace: { select: { id: true, slug: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return members.map((m) => ({
    id: m.workspace.id,
    slug: m.workspace.slug,
    name: m.workspace.name,
    role: m.role,
  }));
}

export async function switchWorkspace(slug: string): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Verify membership before writing the cookie.
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!workspace) redirect("/");
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: session.user.id } },
    select: { userId: true },
  });
  if (!membership) redirect("/");

  const jar = await cookies();
  jar.set("lastWorkspaceSlug", slug, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });

  redirect(`/w/${slug}/dashboard`);
}
