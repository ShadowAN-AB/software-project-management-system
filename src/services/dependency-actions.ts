"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectMember, getTaskProjectId , resolveDefaultWorkspace} from "@/lib/authorization";
import { revalidatePath } from "next/cache";

export async function getTaskDependencies(taskId: string) {
  const session = await auth();
  if (!session?.user) return { blockedBy: [], blocks: [] };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { blockedBy: [], blocks: [] };

  const projectId = await getTaskProjectId(taskId);
  if (!projectId) return { blockedBy: [], blocks: [] };

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { blockedBy: [], blocks: [] };

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
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const projectId = await getTaskProjectId(blockedTaskId);
  if (!projectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a member of this project" };

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

    revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${blockedTaskId}`);
    revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${blockerTaskId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Dependency already exists" };
  }
}

export async function removeDependency(dependencyId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const dep = await prisma.taskDependency.findUnique({ where: { id: dependencyId } });
  if (!dep) return { success: false, error: "Dependency not found" };

  const projectId = await getTaskProjectId(dep.blockedTaskId);
  if (!projectId) return { success: false, error: "Task not found" };
  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  await prisma.taskDependency.delete({ where: { id: dependencyId } });

  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${dep.blockedTaskId}`);
  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${dep.blockerTaskId}`);
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
