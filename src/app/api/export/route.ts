import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectMember, resolveDefaultWorkspace } from "@/lib/authorization";
import { NextResponse } from "next/server";
import { format } from "date-fns";

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignee: { name: string } | null;
  creator: { name: string } | null;
  sprint: { name: string } | null;
  labels: { label: { name: string } }[];
  _count: { subtasks: number; comments: number; timeEntries: number };
  completedSubtasks: number;
  totalMinutes: number;
};

const HEADERS = [
  "ID",
  "Title",
  "Description",
  "Status",
  "Priority",
  "Type",
  "Assignee",
  "Creator",
  "Sprint",
  "Labels",
  "Due Date",
  "Created",
  "Updated",
  "Subtasks",
  "Comments",
  "Time Logged",
];

function taskToCsvRow(task: TaskRow): string {
  const timeLogged = task.totalMinutes > 0
    ? `${Math.floor(task.totalMinutes / 60)}h ${task.totalMinutes % 60}m`
    : "";

  const subtaskStr = task._count.subtasks > 0
    ? `${task.completedSubtasks}/${task._count.subtasks}`
    : "";

  const values = [
    task.id,
    task.title,
    task.description,
    task.status,
    task.priority,
    task.type,
    task.assignee?.name,
    task.creator?.name,
    task.sprint?.name,
    task.labels.map((l) => l.label.name).join("; "),
    task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : null,
    format(new Date(task.createdAt), "yyyy-MM-dd HH:mm"),
    format(new Date(task.updatedAt), "yyyy-MM-dd HH:mm"),
    subtaskStr,
    String(task._count.comments),
    timeLogged,
  ];
  return values.map(escapeCsv).join(",");
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const sprintId = searchParams.get("sprintId");

  if (!projectId && !sprintId) {
    return NextResponse.json(
      { error: "projectId or sprintId is required" },
      { status: 400 }
    );
  }

  let resolvedProjectId = projectId;
  if (sprintId && !resolvedProjectId) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { projectId: true },
    });
    if (!sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
    }
    resolvedProjectId = sprint.projectId;
  }

  const isMember = await requireProjectMember(
    resolvedProjectId!,
    session.user.id,
    ctx
  );
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: Record<string, string> = { projectId: resolvedProjectId! };
  if (sprintId) where.sprintId = sprintId;

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      type: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
      assignee: { select: { name: true } },
      creator: { select: { name: true } },
      sprint: { select: { name: true } },
      labels: { select: { label: { select: { name: true } } } },
      _count: { select: { subtasks: true, comments: true, timeEntries: true } },
    },
  });

  const taskIds = tasks.map((t) => t.id);

  const [subtaskCounts, timeSums] = await Promise.all([
    prisma.subtask.groupBy({
      by: ["taskId"],
      where: { taskId: { in: taskIds }, completed: true },
      _count: true,
    }),
    prisma.timeEntry.groupBy({
      by: ["taskId"],
      where: { taskId: { in: taskIds } },
      _sum: { minutes: true },
    }),
  ]);

  const completedMap = new Map(subtaskCounts.map((s) => [s.taskId, s._count]));
  const timeMap = new Map(timeSums.map((t) => [t.taskId, t._sum.minutes ?? 0]));

  const enrichedTasks: TaskRow[] = tasks.map((t) => ({
    ...t,
    completedSubtasks: completedMap.get(t.id) ?? 0,
    totalMinutes: timeMap.get(t.id) ?? 0,
  }));

  const csv = [
    HEADERS.join(","),
    ...enrichedTasks.map(taskToCsvRow),
  ].join("\n");

  const project = await prisma.project.findUnique({
    where: { id: resolvedProjectId! },
    select: { key: true },
  });

  const filename = sprintId
    ? `${project?.key ?? "export"}_sprint_tasks_${format(new Date(), "yyyy-MM-dd")}.csv`
    : `${project?.key ?? "export"}_tasks_${format(new Date(), "yyyy-MM-dd")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
