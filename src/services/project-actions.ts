"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectMember , resolveDefaultWorkspace} from "@/lib/authorization";
import { projectSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/types";
import { sendProjectAddedEmail } from "@/lib/email";
import { PROJECT_TEMPLATES } from "@/lib/project-templates";

export async function getProjects() {
  const session = await auth();
  if (!session?.user) return [];
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return [];

  const where =
    ctx.role === "ADMIN"
      ? { workspaceId: ctx.workspaceId }
      : { workspaceId: ctx.workspaceId, members: { some: { userId: session.user.id } } };

  return prisma.project.findMany({
    where,
    include: {
      members: { include: { user: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProject(id: string) {
  const session = await auth();
  if (!session?.user) return null;
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return null;

  const isMember = await requireProjectMember(id, session.user.id, ctx);
  if (!isMember) return null;

  return prisma.project.findUnique({
    where: { id },
    include: {
      members: { include: { user: true } },
      tasks: {
        include: {
          assignee: true,
          _count: { select: { comments: true } },
          labels: { include: { label: true } },
        },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
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
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };
  if (!["ADMIN", "PROJECT_MANAGER"].includes(ctx.role)) {
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
    where: { workspaceId_key: { workspaceId: ctx.workspaceId, key: parsed.data.key } },
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
      workspace: { connect: { id: ctx.workspaceId } },
      members: {
        create: {
          userId: session.user.id,
          role: ctx.role,
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

  revalidatePath(`/w/${ctx.workspaceSlug}/dashboard`);
  redirect(`/w/${ctx.workspaceSlug}/projects/${project.id}`);
}

export async function createProjectFromTemplate(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };
  if (!["ADMIN", "PROJECT_MANAGER"].includes(ctx.role)) {
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

  const templateId = formData.get("templateId") as string;
  const template = PROJECT_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return { success: false, error: "Template not found" };
  }

  const existing = await prisma.project.findUnique({
    where: { workspaceId_key: { workspaceId: ctx.workspaceId, key: parsed.data.key } },
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
      workspace: { connect: { id: ctx.workspaceId } },
      members: {
        create: {
          userId: session.user.id,
          role: ctx.role,
        },
      },
    },
  });

  if (template.labels.length > 0) {
    await prisma.label.createMany({
      data: template.labels.map((l) => ({
        name: l.name,
        color: l.color,
        projectId: project.id,
      })),
    });
  }

  if (template.tasks.length > 0) {
    // Space template tasks out so the Gantt view has meaningful bars from the
    // moment the project is created. Each task gets a due date 3 days after the
    // previous one, starting a week out.
    const DAY_MS = 86_400_000;
    const baseline = Date.now() + 7 * DAY_MS;
    await prisma.task.createMany({
      data: template.tasks.map((t, i) => ({
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        type: t.type,
        dueDate: new Date(baseline + i * 3 * DAY_MS),
        projectId: project.id,
        creatorId: session.user.id,
        order: i + 1,
      })),
    });
  }

  await prisma.activityLog.create({
    data: {
      action: "PROJECT_CREATED",
      details: `Created project "${project.name}" from template "${template.name}"`,
      userId: session.user.id,
      projectId: project.id,
    },
  });

  revalidatePath(`/w/${ctx.workspaceSlug}/dashboard`);
  redirect(`/w/${ctx.workspaceSlug}/projects/${project.id}`);
}

export async function updateProjectStatus(projectId: string, status: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  if (!["ADMIN", "PROJECT_MANAGER"].includes(ctx.role)) {
    return { success: false, error: "Only admins and PMs can change project status" };
  }

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a member of this project" };

  await prisma.project.update({
    where: { id: projectId },
    data: { status: status as "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED" },
  });

  revalidatePath(`/w/${ctx.workspaceSlug}/projects/${projectId}`);
  revalidatePath(`/w/${ctx.workspaceSlug}/dashboard`);
  return { success: true, data: undefined };
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  if (!["ADMIN", "PROJECT_MANAGER"].includes(ctx.role)) {
    return { success: false, error: "Only admins and PMs can manage members" };
  }

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "You are not a member of this project" };

  await prisma.projectMember.create({
    data: {
      projectId,
      userId,
      role: role as "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER" | "TESTER",
    },
  });

  const [addedUser, project] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
  ]);
  if (addedUser?.email && project) {
    await sendProjectAddedEmail(addedUser.email, session.user.name ?? "Someone", project.name, projectId);
  }

  revalidatePath(`/w/${ctx.workspaceSlug}/projects/${projectId}`);
  return { success: true, data: undefined };
}

export async function getAllUsers() {
  const session = await auth();
  if (!session?.user) return [];
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return [];
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
  }));
}

export async function removeProjectMember(projectId: string, memberId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  if (!["ADMIN", "PROJECT_MANAGER"].includes(ctx.role)) {
    return { success: false, error: "Only admins and PMs can manage members" };
  }

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "You are not a member of this project" };

  await prisma.projectMember.delete({ where: { id: memberId } });
  revalidatePath(`/w/${ctx.workspaceSlug}/projects/${projectId}`);
  return { success: true, data: undefined };
}
