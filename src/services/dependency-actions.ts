"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getTaskDependencies(taskId: string) {
  const [blockedBy, blocks] = await Promise.all([
    prisma.taskDependency.findMany({
      where: { blockedTaskId: taskId },
      include: { blockerTask: { select: { id: true, title: true, status: true } } },
    }),
    prisma.taskDependency.findMany({
      where: { blockerTaskId: taskId },
      include: { blockedTask: { select: { id: true, title: true, status: true } } },
    }),
  ]);

  return { blockedBy, blocks };
}

export async function addDependency(blockedTaskId: string, blockerTaskId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  if (blockedTaskId === blockerTaskId) {
    return { success: false, error: "A task cannot depend on itself" };
  }

  // Check for circular dependency
  const isCircular = await checkCircularDependency(blockerTaskId, blockedTaskId);
  if (isCircular) {
    return { success: false, error: "This would create a circular dependency" };
  }

  try {
    await prisma.taskDependency.create({
      data: { blockedTaskId, blockerTaskId },
    });

    const task = await prisma.task.findUnique({ where: { id: blockedTaskId } });

    await prisma.activityLog.create({
      data: {
        action: "DEPENDENCY_ADDED",
        details: `Added dependency on task`,
        userId: session.user.id,
        projectId: task?.projectId,
        taskId: blockedTaskId,
      },
    });

    revalidatePath(`/tasks/${blockedTaskId}`);
    revalidatePath(`/tasks/${blockerTaskId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Dependency already exists" };
  }
}

export async function removeDependency(dependencyId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const dep = await prisma.taskDependency.delete({ where: { id: dependencyId } });

  revalidatePath(`/tasks/${dep.blockedTaskId}`);
  revalidatePath(`/tasks/${dep.blockerTaskId}`);
  return { success: true };
}

async function checkCircularDependency(
  taskId: string,
  potentialBlockerId: string,
  visited = new Set<string>()
): Promise<boolean> {
  if (taskId === potentialBlockerId) return true;
  if (visited.has(taskId)) return false;
  visited.add(taskId);

  const deps = await prisma.taskDependency.findMany({
    where: { blockedTaskId: taskId },
    select: { blockerTaskId: true },
  });

  for (const dep of deps) {
    if (await checkCircularDependency(dep.blockerTaskId, potentialBlockerId, visited)) {
      return true;
    }
  }

  return false;
}
