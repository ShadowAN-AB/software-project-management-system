"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/types";

export async function getProjects() {
  const session = await auth();
  if (!session?.user) return [];

  if (session.user.role === "ADMIN") {
    return prisma.project.findMany({
      include: {
        members: { include: { user: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  return prisma.project.findMany({
    where: {
      members: { some: { userId: session.user.id } },
    },
    include: {
      members: { include: { user: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      members: { include: { user: true } },
      tasks: {
        include: { assignee: true },
        orderBy: { createdAt: "desc" },
      },
      sprints: { orderBy: { startDate: "desc" } },
      _count: { select: { tasks: true } },
    },
  });
}

export async function createProject(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!["ADMIN", "PROJECT_MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Only admins and PMs can create projects" };
  }

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    key: formData.get("key"),
    description: formData.get("description"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const existing = await prisma.project.findUnique({
    where: { key: parsed.data.key },
  });
  if (existing) {
    return { success: false, error: "Project key already exists" };
  }

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      key: parsed.data.key,
      description: parsed.data.description || null,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      members: {
        create: {
          userId: session.user.id,
          role: session.user.role,
        },
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "PROJECT_CREATED",
      details: `Created project "${project.name}"`,
      userId: session.user.id,
      projectId: project.id,
    },
  });

  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectStatus(projectId: string, status: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await prisma.project.update({
    where: { id: projectId },
    data: { status: status as "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED" },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await prisma.projectMember.create({
    data: {
      projectId,
      userId,
      role: role as "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER" | "TESTER",
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: undefined };
}

export async function removeProjectMember(projectId: string, memberId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await prisma.projectMember.delete({ where: { id: memberId } });
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: undefined };
}
