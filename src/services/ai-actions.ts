"use server";

import { requireAuth, requireProjectMember, getTaskProjectId, getSprintProjectId , resolveDefaultWorkspace} from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { generateText, generateJSON, isAIEnabled, aiErrorMessage, checkAIRateLimit } from "@/lib/ai";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

function rateLimit(userId: string): ActionResult<never> | null {
  const check = checkAIRateLimit(userId);
  if (check.ok) return null;
  return {
    success: false,
    error: `AI rate limit reached — try again in ${check.retryAfterSec}s.`,
  };
}

export async function isAIAvailable(): Promise<boolean> {
  return isAIEnabled();
}

export async function generateTaskDescription(
  title: string
): Promise<ActionResult<string>> {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const trimmed = title.trim();
  if (trimmed.length < 3) {
    return { success: false, error: "Title too short" };
  }
  if (trimmed.length > 200) {
    return { success: false, error: "Title too long" };
  }

  if (!isAIEnabled()) {
    return { success: false, error: "AI is not configured" };
  }
  const limited = rateLimit(session.user.id);
  if (limited) return limited;

  const system = `You are a technical project manager writing task descriptions for a software team. Given a task title, produce a concise, structured description in Markdown.

Format:
**Overview**
1–2 sentences explaining the task.

**Acceptance Criteria**
- 3–5 bulleted, testable criteria.

Keep it tight. No fluff, no restating the title, no headings other than the two above.`;

  const result = await generateText(system, `Task title: ${trimmed}`, 600);
  if (!result.ok) return { success: false, error: aiErrorMessage(result.error) };

  return { success: true, data: result.value.trim() };
}

export async function decomposeTask(
  taskId: string
): Promise<ActionResult<{ created: number }>> {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const projectId = await getTaskProjectId(taskId);
  if (!projectId) return { success: false, error: "Task not found" };

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a project member" };

  if (!isAIEnabled()) {
    return { success: false, error: "AI is not configured" };
  }
  const limited = rateLimit(session.user.id);
  if (limited) return limited;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { title: true, description: true, type: true },
  });
  if (!task) return { success: false, error: "Task not found" };

  const system = `You are a technical project manager decomposing a software task into concrete subtasks a developer can check off.

Return a JSON object of the form { "subtasks": ["...", "..."] } with 3 to 6 items.

Rules:
- Each subtask is a short imperative phrase (max 80 characters), e.g. "Add /login endpoint", "Write unit tests for auth guard".
- Cover the work end-to-end: design/setup, implementation, tests, docs where appropriate.
- Do not restate the parent task title. Do not include numbering.`;

  const userPrompt = `Parent task: ${task.title}
Type: ${task.type}
${task.description ? `Description:\n${task.description}` : "(No description provided.)"}`;

  const parsed = await generateJSON<{ subtasks?: unknown }>(system, userPrompt, 800);
  if (!parsed.ok) return { success: false, error: aiErrorMessage(parsed.error) };
  const items = Array.isArray(parsed.value.subtasks) ? parsed.value.subtasks : null;
  if (!items || items.length === 0) {
    return { success: false, error: "Generation returned no subtasks" };
  }

  const cleaned = items
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().replace(/^\d+[.)]\s*/, "").slice(0, 200))
    .filter((s) => s.length > 0)
    .slice(0, 6);

  if (cleaned.length === 0) {
    return { success: false, error: "Generation returned no usable subtasks" };
  }

  const maxOrder = await prisma.subtask.aggregate({
    where: { taskId },
    _max: { order: true },
  });
  const baseOrder = (maxOrder._max.order ?? -1) + 1;

  await prisma.subtask.createMany({
    data: cleaned.map((title, i) => ({
      taskId,
      title,
      order: baseOrder + i,
    })),
  });

  revalidatePath(`/w/${ctx.workspaceSlug}/tasks/${taskId}`);
  return { success: true, data: { created: cleaned.length } };
}

export async function generateSprintRetro(
  sprintId: string
): Promise<ActionResult<string>> {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const projectId = await getSprintProjectId(sprintId);
  if (!projectId) return { success: false, error: "Sprint not found" };

  const isMember = await requireProjectMember(projectId, session.user.id, ctx);
  if (!isMember) return { success: false, error: "Not a project member" };

  if (!isAIEnabled()) {
    return { success: false, error: "AI is not configured" };
  }
  const limited = rateLimit(session.user.id);
  if (limited) return limited;

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      tasks: {
        include: {
          assignee: { select: { name: true } },
          timeEntries: { select: { minutes: true } },
        },
      },
    },
  });
  if (!sprint) return { success: false, error: "Sprint not found" };

  const total = sprint.tasks.length;
  if (total === 0) {
    return { success: false, error: "No tasks in this sprint to analyze" };
  }

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byAssignee: Record<string, { done: number; open: number; minutes: number }> = {};
  let totalMinutes = 0;
  let doneMinutes = 0;

  for (const t of sprint.tasks) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;

    const mins = t.timeEntries.reduce((s, e) => s + e.minutes, 0);
    totalMinutes += mins;
    if (t.status === "DONE") doneMinutes += mins;

    const name = t.assignee?.name ?? "Unassigned";
    if (!byAssignee[name]) byAssignee[name] = { done: 0, open: 0, minutes: 0 };
    if (t.status === "DONE") byAssignee[name].done += 1;
    else byAssignee[name].open += 1;
    byAssignee[name].minutes += mins;
  }

  const doneCount = byStatus["DONE"] ?? 0;
  const completionRate = Math.round((doneCount / total) * 100);

  const durationDays = Math.max(
    1,
    Math.round(
      (new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const fmtHours = (m: number) => (m / 60).toFixed(1);

  const metrics = `Sprint: ${sprint.name}
Goal: ${sprint.goal ?? "(none)"}
Status: ${sprint.status}
Duration: ${durationDays} day(s) (${sprint.startDate.toISOString().slice(0, 10)} → ${sprint.endDate.toISOString().slice(0, 10)})
Tasks: ${total} total, ${doneCount} done (${completionRate}%)
Status breakdown: ${Object.entries(byStatus).map(([s, n]) => `${s}=${n}`).join(", ")}
Priority breakdown: ${Object.entries(byPriority).map(([p, n]) => `${p}=${n}`).join(", ")}
Time logged: ${fmtHours(totalMinutes)}h total, ${fmtHours(doneMinutes)}h on completed work
Per assignee: ${Object.entries(byAssignee)
    .map(([n, v]) => `${n} (done=${v.done}, open=${v.open}, ${fmtHours(v.minutes)}h)`)
    .join("; ")}`;

  const system = `You are a seasoned agile coach writing a sprint retrospective. Given raw sprint metrics, produce a concise Markdown retro.

Format exactly:

**Summary**
1–2 sentences on how the sprint went, grounded in the metrics.

**What went well**
- 2–4 bullets citing specific numbers.

**What to improve**
- 2–4 bullets citing specific numbers or patterns.

**Action items**
- 2–3 concrete next-sprint actions.

Rules: cite real numbers from the input. Do not invent people, tasks, or events. If the sprint underperformed, be honest but constructive. Keep it under ~250 words total.`;

  const result = await generateText(system, metrics, 900);
  if (!result.ok) return { success: false, error: aiErrorMessage(result.error) };

  return { success: true, data: result.value.trim() };
}

const STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const TYPES = ["FEATURE", "BUG", "IMPROVEMENT", "TASK"] as const;

type TaskFilter = {
  status?: string[];
  priority?: string[];
  type?: string[];
  overdue?: boolean;
  dueWithinDays?: number;
  titleContains?: string;
};

export type SearchedTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  dueDate: Date | null;
  updatedAt: Date;
  project: { id: string; name: string; key: string };
  sprint: { name: string } | null;
};

export async function searchMyTasks(
  query: string
): Promise<ActionResult<{ tasks: SearchedTask[]; filter: TaskFilter }>> {
  const session = await requireAuth();
  if (!session) return { success: false, error: "Unauthorized" };
  const ctx = await resolveDefaultWorkspace(session.user.id);
  if (!ctx) return { success: false, error: "No workspace" };

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { success: false, error: "Query too short" };
  }
  if (trimmed.length > 300) {
    return { success: false, error: "Query too long" };
  }

  if (!isAIEnabled()) {
    return { success: false, error: "AI is not configured" };
  }
  const limited = rateLimit(session.user.id);
  if (limited) return limited;

  const system = `You translate natural-language task search queries into a strict JSON filter object for a project-management app.

Return ONLY a JSON object with this shape (omit any field the user did not request):
{
  "status": ["BACKLOG"|"TODO"|"IN_PROGRESS"|"IN_REVIEW"|"DONE", ...],
  "priority": ["LOW"|"MEDIUM"|"HIGH"|"CRITICAL", ...],
  "type": ["FEATURE"|"BUG"|"IMPROVEMENT"|"TASK", ...],
  "overdue": true,
  "dueWithinDays": <positive integer, max 60>,
  "titleContains": "<free-text substring, only if the user mentioned specific keywords>"
}

Rules:
- Use enum values exactly as listed. Never invent values.
- "high priority" → priority ["HIGH", "CRITICAL"]. "critical" → ["CRITICAL"] only.
- "bugs" → type ["BUG"]. "features" → ["FEATURE"].
- "in progress" or "active" → status ["TODO", "IN_PROGRESS", "IN_REVIEW"].
- "done" or "completed" → ["DONE"]. "not done" or "open" → ["BACKLOG","TODO","IN_PROGRESS","IN_REVIEW"].
- "overdue" or "late" → overdue: true.
- "due this week" → dueWithinDays: 7. "due today" → dueWithinDays: 1. "due soon" → 3.
- Only use titleContains when the query includes distinctive keywords not covered by other fields (e.g. "auth", "checkout flow"). Do NOT put common words like "task", "issue", "please" into it.
- If the query is empty or nonsensical, return {}.`;

  const parsed = await generateJSON<TaskFilter>(system, `Query: ${trimmed}`, 400);
  if (!parsed.ok) return { success: false, error: aiErrorMessage(parsed.error) };
  const filter = parsed.value;

  const safe: TaskFilter = {};
  if (Array.isArray(filter.status)) {
    safe.status = filter.status.filter((s): s is string =>
      typeof s === "string" && (STATUSES as readonly string[]).includes(s)
    );
    if (safe.status.length === 0) delete safe.status;
  }
  if (Array.isArray(filter.priority)) {
    safe.priority = filter.priority.filter((p): p is string =>
      typeof p === "string" && (PRIORITIES as readonly string[]).includes(p)
    );
    if (safe.priority.length === 0) delete safe.priority;
  }
  if (Array.isArray(filter.type)) {
    safe.type = filter.type.filter((t): t is string =>
      typeof t === "string" && (TYPES as readonly string[]).includes(t)
    );
    if (safe.type.length === 0) delete safe.type;
  }
  if (filter.overdue === true) safe.overdue = true;
  if (
    typeof filter.dueWithinDays === "number" &&
    Number.isFinite(filter.dueWithinDays) &&
    filter.dueWithinDays > 0
  ) {
    safe.dueWithinDays = Math.min(60, Math.floor(filter.dueWithinDays));
  }
  if (typeof filter.titleContains === "string") {
    const t = filter.titleContains.trim();
    if (t.length >= 2 && t.length <= 100) safe.titleContains = t;
  }

  const where: {
    assigneeId: string;
    status?: { in: string[] } | { not: string };
    priority?: { in: string[] };
    type?: { in: string[] };
    title?: { contains: string; mode: "insensitive" };
    dueDate?: { lt?: Date; gte?: Date; lte?: Date };
    OR?: unknown[];
  } = { assigneeId: session.user.id };

  if (safe.status) where.status = { in: safe.status };
  if (safe.priority) where.priority = { in: safe.priority };
  if (safe.type) where.type = { in: safe.type };
  if (safe.titleContains) {
    where.title = { contains: safe.titleContains, mode: "insensitive" };
  }

  const now = new Date();
  const dueWithinEnd =
    safe.dueWithinDays !== undefined
      ? new Date(now.getTime() + safe.dueWithinDays * 86_400_000)
      : null;

  if (safe.overdue && dueWithinEnd) {
    // "overdue or due soon" — the two ranges don't overlap, so use OR
    where.OR = [
      { dueDate: { lt: now } },
      { dueDate: { gte: now, lte: dueWithinEnd } },
    ];
    if (!safe.status) where.status = { not: "DONE" };
  } else if (safe.overdue) {
    where.dueDate = { lt: now };
    if (!safe.status) where.status = { not: "DONE" };
  } else if (dueWithinEnd) {
    where.dueDate = { gte: now, lte: dueWithinEnd };
  }

  const tasks = await prisma.task.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: where as any,
    include: {
      project: { select: { id: true, name: true, key: true } },
      sprint: { select: { name: true } },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return { success: true, data: { tasks, filter: safe } };
}
