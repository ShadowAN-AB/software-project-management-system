import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}

export async function requireProjectMember(projectId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;

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
