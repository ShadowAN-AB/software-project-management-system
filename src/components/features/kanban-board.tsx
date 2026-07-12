"use client";

import { useState, useTransition, useRef, useMemo } from "react";
import { bulkUpdateTasks, bulkDeleteTasks, reorderTasks } from "@/services/task-actions";
import { PriorityBadge, DueDateBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  MessageSquare,
  Bug,
  Sparkles,
  Wrench,
  CheckSquare,
  Filter,
  X,
  SortAsc,
  Trash2,
  ArrowRight,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import type { TaskStatus } from "@prisma/client";
import { useEventStream } from "@/hooks/use-event-stream";
import type { SSEFrame } from "@/lib/sse-events";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  type: string;
  order?: number;
  dueDate: Date | null;
  assignee: { id: string; name: string } | null;
  _count: { comments: number };
  labels?: { id: string; label: { id: string; name: string; color: string } }[];
};

type FilterState = {
  assignee: string | null;
  priority: string | null;
  type: string | null;
  label: string | null;
  dueDateFilter: "all" | "overdue" | "due-this-week" | "no-date";
};

type SortOption = "priority" | "due-date" | "title" | "none";

const COLUMNS: { status: TaskStatus; label: string; dotColor: string }[] = [
  { status: "BACKLOG", label: "Backlog", dotColor: "bg-zinc-400" },
  { status: "TODO", label: "To Do", dotColor: "bg-blue-500" },
  { status: "IN_PROGRESS", label: "In Progress", dotColor: "bg-amber-500" },
  { status: "IN_REVIEW", label: "In Review", dotColor: "bg-violet-500" },
  { status: "DONE", label: "Done", dotColor: "bg-emerald-500" },
];

const TYPE_ICONS: Record<string, typeof Bug> = {
  BUG: Bug,
  FEATURE: Sparkles,
  IMPROVEMENT: Wrench,
  TASK: CheckSquare,
};

const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function isOverdue(d: Date | null): boolean {
  if (!d) return false;
  return new Date(d) < new Date(new Date().toDateString());
}

function isDueThisWeek(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);
  return new Date(d) <= endOfWeek && new Date(d) >= new Date(now.toDateString());
}

export function KanbanBoard({
  tasks: initialTasks,
  projectId,
  currentUserId,
  members = [],
}: {
  tasks: Task[];
  projectId: string;
  currentUserId: string;
  members?: { id: string; name: string }[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [lastInitial, setLastInitial] = useState(initialTasks);
  if (lastInitial !== initialTasks) {
    setLastInitial(initialTasks);
    setTasks(initialTasks);
  }
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [dropTarget, setDropTarget] = useState<{ status: TaskStatus; index: number } | null>(null);
  const [, startTransition] = useTransition();
  const draggedTaskRef = useRef<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    assignee: null,
    priority: null,
    type: null,
    label: null,
    dueDateFilter: "all",
  });
  const [sortBy, setSortBy] = useState<SortOption>("none");
  const [showFilters, setShowFilters] = useState(false);

  // Bulk selection state
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEventStream({
    channels: [`project:${projectId}`],
    currentUserId,
    handlers: {
      "task:created": (event: SSEFrame) => {
        if (event.type !== "task:created") return;
        setTasks((prev) => {
          if (prev.some((t) => t.id === event.task.id)) return prev;
          return [...prev, event.task as unknown as Task];
        });
      },
      "task:statusChanged": (event: SSEFrame) => {
        if (event.type !== "task:statusChanged") return;
        if (draggedTaskRef.current) return;
        setTasks((prev) =>
          prev.map((t) =>
            t.id === event.taskId ? { ...t, status: event.status } : t
          )
        );
      },
      "task:updated": (event: SSEFrame) => {
        if (event.type !== "task:updated") return;
        setTasks((prev) =>
          prev.map((t) =>
            t.id === event.taskId ? { ...t, ...event.changes } : t
          )
        );
      },
      "task:deleted": (event: SSEFrame) => {
        if (event.type !== "task:deleted") return;
        setTasks((prev) => prev.filter((t) => t.id !== event.taskId));
        setSelectedTasks((prev) => {
          const next = new Set(prev);
          next.delete(event.taskId);
          return next;
        });
      },
      "task:bulkUpdated": (event: SSEFrame) => {
        if (event.type !== "task:bulkUpdated") return;
        setTasks((prev) =>
          prev.map((t) =>
            event.taskIds.includes(t.id) ? { ...t, ...event.changes } : t
          )
        );
      },
      "task:bulkDeleted": (event: SSEFrame) => {
        if (event.type !== "task:bulkDeleted") return;
        setTasks((prev) => prev.filter((t) => !event.taskIds.includes(t.id)));
        setSelectedTasks((prev) => {
          const next = new Set(prev);
          for (const id of event.taskIds) next.delete(id);
          return next;
        });
      },
      "task:reordered": (event: SSEFrame) => {
        if (event.type !== "task:reordered") return;
        if (draggedTaskRef.current) return;
        const orderMap = new Map(event.orderedIds.map((id, i) => [id, i]));
        setTasks((prev) =>
          prev.map((t) =>
            orderMap.has(t.id)
              ? { ...t, status: event.status, order: orderMap.get(t.id)! }
              : t
          )
        );
      },
    },
  });

  // Derive unique filter options from tasks
  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      if (t.assignee) map.set(t.assignee.id, t.assignee.name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);

  const labelOptions = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const t of tasks) {
      for (const tl of t.labels ?? []) {
        map.set(tl.label.id, { name: tl.label.name, color: tl.label.color });
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [tasks]);

  const activeFilterCount = [
    filters.assignee,
    filters.priority,
    filters.type,
    filters.label,
    filters.dueDateFilter !== "all" ? filters.dueDateFilter : null,
  ].filter(Boolean).length;

  // Filter + sort
  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (filters.assignee) {
      result = result.filter((t) => t.assignee?.id === filters.assignee);
    }
    if (filters.priority) {
      result = result.filter((t) => t.priority === filters.priority);
    }
    if (filters.type) {
      result = result.filter((t) => t.type === filters.type);
    }
    if (filters.label) {
      result = result.filter((t) =>
        t.labels?.some((tl) => tl.label.id === filters.label)
      );
    }
    if (filters.dueDateFilter === "overdue") {
      result = result.filter((t) => isOverdue(t.dueDate) && t.status !== "DONE");
    } else if (filters.dueDateFilter === "due-this-week") {
      result = result.filter((t) => isDueThisWeek(t.dueDate));
    } else if (filters.dueDateFilter === "no-date") {
      result = result.filter((t) => !t.dueDate);
    }

    if (sortBy === "priority") {
      result = [...result].sort(
        (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
      );
    } else if (sortBy === "due-date") {
      result = [...result].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else if (sortBy === "title") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [tasks, filters, sortBy]);

  function clearFilters() {
    setFilters({ assignee: null, priority: null, type: null, label: null, dueDateFilter: "all" });
    setSortBy("none");
  }

  function toggleTask(taskId: string) {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedTasks(new Set(filteredTasks.map((t) => t.id)));
  }

  function clearSelection() {
    setSelectedTasks(new Set());
    setConfirmDelete(false);
  }

  async function handleBulkStatus(status: TaskStatus) {
    setBulkPending(true);
    const ids = [...selectedTasks];
    setTasks((prev) => prev.map((t) => (selectedTasks.has(t.id) ? { ...t, status } : t)));
    const result = await bulkUpdateTasks(projectId, ids, { status });
    if (!result.success) {
      setTasks(initialTasks);
    }
    clearSelection();
    setBulkPending(false);
  }

  async function handleBulkPriority(priority: string) {
    setBulkPending(true);
    const ids = [...selectedTasks];
    setTasks((prev) => prev.map((t) => (selectedTasks.has(t.id) ? { ...t, priority } : t)));
    const result = await bulkUpdateTasks(projectId, ids, { priority });
    if (!result.success) {
      setTasks(initialTasks);
    }
    clearSelection();
    setBulkPending(false);
  }

  async function handleBulkAssignee(assigneeId: string | null) {
    setBulkPending(true);
    const ids = [...selectedTasks];
    const assignee = assigneeId ? members.find((m) => m.id === assigneeId) ?? null : null;
    setTasks((prev) =>
      prev.map((t) =>
        selectedTasks.has(t.id) ? { ...t, assigneeId: assigneeId, assignee } : t
      )
    );
    const result = await bulkUpdateTasks(projectId, ids, { assigneeId });
    if (!result.success) {
      setTasks(initialTasks);
    }
    clearSelection();
    setBulkPending(false);
  }

  async function handleBulkDelete() {
    setBulkPending(true);
    const ids = [...selectedTasks];
    setTasks((prev) => prev.filter((t) => !selectedTasks.has(t.id)));
    const result = await bulkDeleteTasks(projectId, ids);
    if (!result.success) {
      setTasks(initialTasks);
    }
    clearSelection();
    setBulkPending(false);
  }

  function handleDragStart(taskId: string) {
    setDraggedTask(taskId);
    draggedTaskRef.current = taskId;
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    setDragOverColumn(status);
  }

  function handleCardDragOver(
    e: React.DragEvent,
    status: TaskStatus,
    cardIndex: number
  ) {
    if (!draggedTaskRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    setDragOverColumn(status);
    setDropTarget({ status, index: above ? cardIndex : cardIndex + 1 });
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  function handleDrop(status: TaskStatus) {
    const target = dropTarget;
    setDragOverColumn(null);
    setDropTarget(null);
    if (!draggedTask) return;

    const task = tasks.find((t) => t.id === draggedTask);
    if (!task) {
      setDraggedTask(null);
      return;
    }

    const capturedDraggedTask = draggedTask;
    const previousStatus = task.status;
    setDraggedTask(null);
    draggedTaskRef.current = null;

    // Compute new column order for reorderTasks
    const columnTasks = tasks
      .filter((t) => t.status === status && t.id !== capturedDraggedTask)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const insertAt =
      target && target.status === status
        ? Math.min(target.index, columnTasks.length)
        : columnTasks.length;
    const newOrderIds = [
      ...columnTasks.slice(0, insertAt).map((t) => t.id),
      capturedDraggedTask,
      ...columnTasks.slice(insertAt).map((t) => t.id),
    ];

    if (previousStatus === status) {
      const currentOrder = tasks
        .filter((t) => t.status === status)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((t) => t.id);
      if (
        currentOrder.length === newOrderIds.length &&
        currentOrder.every((id, i) => id === newOrderIds[i])
      ) {
        return;
      }
    }

    // Optimistic update: apply new order + status
    const orderMap = new Map(newOrderIds.map((id, i) => [id, i]));
    setTasks((prev) =>
      prev.map((t) =>
        orderMap.has(t.id)
          ? { ...t, status, order: orderMap.get(t.id)! }
          : t
      )
    );

    startTransition(async () => {
      const result = await reorderTasks(projectId, status, newOrderIds);
      if (!result.success) {
        setTasks(initialTasks);
      }
    });
  }

  function handleDragEnd() {
    setDraggedTask(null);
    draggedTaskRef.current = null;
    setDragOverColumn(null);
    setDropTarget(null);
  }

  const selectionMode = selectedTasks.size > 0;

  return (
    <div>
      {/* Header with filter toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Board
        </h2>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              showFilters || activeFilterCount > 0
                ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="mb-4 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-3">
          <div className="flex flex-wrap gap-3">
            {/* Assignee */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Assignee
              </label>
              <select
                value={filters.assignee ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value || null }))}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 min-w-[140px]"
              >
                <option value="">All</option>
                {assignees.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
                <option value="__unassigned__">Unassigned</option>
              </select>
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Priority
              </label>
              <select
                value={filters.priority ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value || null }))}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 min-w-[120px]"
              >
                <option value="">All</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Type
              </label>
              <select
                value={filters.type ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value || null }))}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 min-w-[120px]"
              >
                <option value="">All</option>
                <option value="BUG">Bug</option>
                <option value="FEATURE">Feature</option>
                <option value="IMPROVEMENT">Improvement</option>
                <option value="TASK">Task</option>
              </select>
            </div>

            {/* Label */}
            {labelOptions.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Label
                </label>
                <select
                  value={filters.label ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, label: e.target.value || null }))}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 min-w-[120px]"
                >
                  <option value="">All</option>
                  {labelOptions.map(([id, { name }]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Due Date */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Due Date
              </label>
              <select
                value={filters.dueDateFilter}
                onChange={(e) => setFilters((f) => ({ ...f, dueDateFilter: e.target.value as FilterState["dueDateFilter"] }))}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 min-w-[140px]"
              >
                <option value="all">All</option>
                <option value="overdue">Overdue</option>
                <option value="due-this-week">Due this week</option>
                <option value="no-date">No due date</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Sort by
              </label>
              <div className="flex items-center gap-1">
                <SortAsc className="h-3.5 w-3.5 text-zinc-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 min-w-[120px]"
                >
                  <option value="none">Default</option>
                  <option value="priority">Priority</option>
                  <option value="due-date">Due date</option>
                  <option value="title">Title</option>
                </select>
              </div>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Showing {filteredTasks.length} of {tasks.length} tasks
            </p>
          )}
        </div>
      )}

      {/* Bulk actions toolbar */}
      {selectionMode && (
        <div className="mb-4 flex flex-wrap items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl">
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300 mr-1">
            {selectedTasks.size} selected
          </span>
          <button
            onClick={selectAllVisible}
            className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md"
          >
            Select all ({filteredTasks.length})
          </button>
          <button
            onClick={clearSelection}
            className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md"
          >
            Clear
          </button>

          <div className="h-4 w-px bg-blue-200 dark:bg-blue-800 mx-1" />

          {/* Move to status */}
          <div className="flex items-center gap-1">
            <ArrowRight className="h-3.5 w-3.5 text-blue-500" />
            <select
              disabled={bulkPending}
              defaultValue=""
              onChange={(e) => { if (e.target.value) handleBulkStatus(e.target.value as TaskStatus); e.target.value = ""; }}
              className="text-xs px-2 py-1 rounded-md border border-blue-200 dark:border-blue-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              <option value="" disabled>Move to...</option>
              {COLUMNS.map((c) => (
                <option key={c.status} value={c.status}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <select
            disabled={bulkPending}
            defaultValue=""
            onChange={(e) => { if (e.target.value) handleBulkPriority(e.target.value); e.target.value = ""; }}
            className="text-xs px-2 py-1 rounded-md border border-blue-200 dark:border-blue-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          >
            <option value="" disabled>Priority...</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Assignee */}
          {members.length > 0 && (
            <div className="flex items-center gap-1">
              <UserPlus className="h-3.5 w-3.5 text-blue-500" />
              <select
                disabled={bulkPending}
                defaultValue=""
                onChange={(e) => { handleBulkAssignee(e.target.value || null); e.target.value = ""; }}
                className="text-xs px-2 py-1 rounded-md border border-blue-200 dark:border-blue-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >
                <option value="" disabled>Assign to...</option>
                <option value="">Unassign</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="h-4 w-px bg-blue-200 dark:bg-blue-800 mx-1" />

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs text-red-600 dark:text-red-400">Delete {selectedTasks.size}?</span>
              <button
                disabled={bulkPending}
                onClick={handleBulkDelete}
                className="text-xs px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-2 py-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              disabled={bulkPending}
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      )}

      {/* Board columns */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const columnTasks = filteredTasks
            .filter((t) => {
              if (filters.assignee === "__unassigned__") {
                return t.status === col.status && !t.assignee;
              }
              return t.status === col.status;
            })
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const isOver = dragOverColumn === col.status && draggedTask !== null;
          const activeDropIndex =
            dropTarget && dropTarget.status === col.status && draggedTask !== null
              ? dropTarget.index
              : -1;

          return (
            <div
              key={col.status}
              className={`flex-shrink-0 w-[272px] rounded-2xl transition-colors duration-150 ${
                isOver
                  ? "bg-blue-50/80 dark:bg-blue-950/30 ring-2 ring-blue-200 dark:ring-blue-800 ring-inset"
                  : "bg-zinc-50 dark:bg-zinc-900/40"
              }`}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(col.status)}
            >
              {/* Column header */}
              <div className="px-3 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                  <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                    {col.label}
                  </h3>
                </div>
                <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 font-medium">
                  {columnTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="px-2 pb-2 space-y-2 min-h-[80px]">
                {columnTasks.map((task, cardIndex) => {
                  const TypeIcon = TYPE_ICONS[task.type] || CheckSquare;
                  const isSelected = selectedTasks.has(task.id);
                  const showIndicatorAbove =
                    activeDropIndex === cardIndex && draggedTask !== task.id;
                  return (
                    <div key={task.id}>
                      {showIndicatorAbove && (
                        <div className="h-0.5 -my-1 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                      )}
                    <div
                      draggable={!selectionMode}
                      onDragStart={() => handleDragStart(task.id)}
                      onDragOver={(e) => handleCardDragOver(e, col.status, cardIndex)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white dark:bg-zinc-900 p-3 rounded-xl border shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] transition-all duration-150 ${
                        isSelected
                          ? "border-blue-400 dark:border-blue-500 ring-2 ring-blue-100 dark:ring-blue-950"
                          : "border-zinc-200/70 dark:border-zinc-800 hover:shadow-[0_4px_12px_rgb(0_0_0_/_0.06)] hover:border-zinc-300 dark:hover:border-zinc-700"
                      } ${
                        selectionMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
                      } ${
                        draggedTask === task.id
                          ? "opacity-40 scale-[0.97] rotate-1"
                          : ""
                      }`}
                      onClick={selectionMode ? () => toggleTask(task.id) : undefined}
                    >
                      <div className="flex items-start gap-2 mb-2.5">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                          className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded border-2 transition-colors flex items-center justify-center ${
                            isSelected
                              ? "bg-blue-500 border-blue-500 text-white"
                              : "border-zinc-300 dark:border-zinc-600 hover:border-blue-400"
                          }`}
                        >
                          {isSelected && (
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <TypeIcon
                          className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                            task.type === "BUG"
                              ? "text-red-500"
                              : task.type === "FEATURE"
                                ? "text-violet-500"
                                : "text-zinc-400"
                          }`}
                          strokeWidth={1.75}
                        />
                        <Link
                          href={`/tasks/${task.id}`}
                          className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          {task.title}
                        </Link>
                      </div>
                      {task.labels && task.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {task.labels.map((tl) => (
                            <span
                              key={tl.id}
                              className="inline-block px-1.5 py-0 rounded text-[10px] font-medium text-white leading-4"
                              style={{ backgroundColor: tl.label.color }}
                            >
                              {tl.label.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {task.dueDate && task.status !== "DONE" && (
                        <div className="mb-2">
                          <DueDateBadge dueDate={task.dueDate} compact />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <PriorityBadge priority={task.priority} />
                        <div className="flex items-center gap-2">
                          {task._count.comments > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-zinc-400">
                              <MessageSquare className="h-3 w-3" strokeWidth={1.75} />
                              {task._count.comments}
                            </span>
                          )}
                          {task.assignee && (
                            <Avatar name={task.assignee.name} size="xs" title={task.assignee.name} />
                          )}
                        </div>
                      </div>
                    </div>
                    </div>
                  );
                })}
                {activeDropIndex === columnTasks.length && draggedTask !== null && (
                  <div className="h-0.5 -mt-1 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
