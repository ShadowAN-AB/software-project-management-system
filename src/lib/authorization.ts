import { cache } from "react";
import { notFound } from "next/navigation";
import { auth, getCachedWorkspaceRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { WorkspaceContext } from "@/types";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}

/**
 * Resolve the workspace slug to a WorkspaceContext for the current user.
 * Calls notFound() (→ 404) if the workspace doesn't exist OR the user isn't a member;
 * we deliberately don't distinguish the two so we don't leak workspace existence.
 */
export const requireWorkspaceMember = cache(
  async (workspaceSlug: string, userId: string): Promise<WorkspaceContext> => {
    const workspace = await prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      select: { id: true, slug: true },
    });
    if (!workspace) notFound();

    const role = await getCachedWorkspaceRole(userId, workspace.id);
    if (!role) notFound();

    return { workspaceId: workspace.id, workspaceSlug: workspace.slug, role };
  }
);

/**
 * Resolve the caller's current workspace.
 *
 * Priority order:
 *   1. `lastWorkspaceSlug` cookie (set by `switchWorkspace` and the workspace layout)
 *      — validated against the user's memberships before use.
 *   2. First membership by `joinedAt` — fallback for freshly-registered users
 *      who haven't hit the workspace layout yet.
 *
 * The cookie step is what makes this URL-aware without every action needing to
 * accept a slug param. Server actions invoked from client forms (which can't
 * pass params) still see the correct current workspace because the cookie is
 * refreshed on every visit to `/w/[slug]/…` by the workspace layout.
 */
export async function resolveDefaultWorkspace(
  userId: string
): Promise<WorkspaceContext | null> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const preferredSlug = jar.get("lastWorkspaceSlug")?.value;

  if (preferredSlug) {
    const workspace = await prisma.workspace.findUnique({
      where: { slug: preferredSlug },
      select: { id: true, slug: true },
    });
    if (workspace) {
      const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
        select: { role: true },
      });
      if (membership) {
        return {
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
          role: membership.role,
        };
      }
    }
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      workspace: { select: { id: true, slug: true } },
    },
  });
  if (!member) return null;
  return {
    workspaceId: member.workspace.id,
    workspaceSlug: member.workspace.slug,
    role: member.role,
  };
}

/**
 * Verify a project belongs to the caller's current workspace and the caller
 * has membership rights on it. Returns true on success, false on plain membership miss.
 * Calls notFound() when the project doesn't exist or lives in another workspace
 * — this closes the pre-refactor hole where a workspace ADMIN could hit any projectId.
 */
export async function requireProjectMember(
  projectId: string,
  userId: string,
  ctx: WorkspaceContext
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!project || project.workspaceId !== ctx.workspaceId) notFound();

  if (ctx.role === "ADMIN") return true;

  const membership = await prisma.projectMember.findFirst({
    where: { projectId, userId },
  });
  return !!membership;
}

export async function getTaskProjectId(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  return task?.projectId ?? null;
}

export async function getSprintProjectId(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { projectId: true },
  });
  return sprint?.projectId ?? null;
}
