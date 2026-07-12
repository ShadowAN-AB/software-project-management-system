"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function globalSearch(query: string) {
  const session = await auth();
  if (!session?.user || !query.trim()) return { projects: [], tasks: [], users: [] };

  const isAdmin = session.user.role === "ADMIN";
  const userId = session.user.id;

  // Search projects
  const projects = await prisma.project.findMany({
    where: {
      AND: [
        isAdmin ? {} : { members: { some: { userId } } },
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
        isAdmin ? {} : { project: { members: { some: { userId } } } },
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

  // Search users (admin only)
  const users = isAdmin
    ? await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, email: true, role: true },
        take: 5,
      })
    : [];

  return { projects, tasks, users };
}
