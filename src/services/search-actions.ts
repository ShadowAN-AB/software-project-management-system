"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDefaultWorkspace } from "@/lib/authorization";

export async function globalSearch(query: string) {
  const session = await auth();
  if (!session?.user || !query.trim()) return { projects: [], tasks: [], users: [] };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { projects: [], tasks: [], users: [] };

  const isAdmin = ctx.role === "ADMIN";
  const userId = session.user.id;
  const workspaceId = ctx.workspaceId;

  const projectScope = isAdmin
    ? { workspaceId }
    : { workspaceId, members: { some: { userId } } };

  // Search projects
  const projects = await prisma.project.findMany({
    where: {
      AND: [
        projectScope,
        {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { key: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: { id: true, name: true, key: true, status: true },
    take: 5,
  });

  // Search tasks
  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        { project: projectScope },
        {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      project: { select: { key: true } },
    },
    take: 8,
  });

  // Search users in current workspace (admin only)
  const users = isAdmin
    ? (await prisma.workspaceMember.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          user: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
        },
        include: { user: { select: { id: true, name: true, email: true } } },
        take: 5,
      })).map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      }))
    : [];

  return { projects, tasks, users };
}
