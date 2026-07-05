"use client";

import { useState, useTransition, useRef } from "react";
import { updateTaskStatus } from "@/services/task-actions";
import { PriorityBadge, DueDateBadge } from "@/components/ui/badge";
import { User, MessageSquare, Bug, Sparkles, Wrench, CheckSquare } from "lucide-react";
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
  dueDate: Date | null;
  assignee: { id: string; name: string } | null;
  _count: { comments: number };
  labels?: { id: string; label: { id: string; name: string; color: string } }[];
};

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

export function KanbanBoard({
  tasks: initialTasks,
  projectId,
  currentUserId,
}: {
  tasks: Task[];
  projectId: string;
  currentUserId: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [, startTransition] = useTransition();
  const draggedTaskRef = useRef<string | null>(null);

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
      },
    },
  });

  function handleDragStart(taskId: string) {
    setDraggedTask(taskId);
    draggedTaskRef.current = taskId;
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    setDragOverColumn(status);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  function handleDrop(status: TaskStatus) {
    setDragOverColumn(null);
    if (!draggedTask) return;

    const task = tasks.find((t) => t.id === draggedTask);
    if (!task || task.status === status) {
      setDraggedTask(null);
      return;
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === draggedTask ? { ...t, status } : t))
    );
    const capturedDraggedTask = draggedTask;
    setDraggedTask(null);
    draggedTaskRef.current = null;

    startTransition(async () => {
      const result = await updateTaskStatus(capturedDraggedTask, status);
      if (!result.success) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === capturedDraggedTask ? { ...t, status: task.status } : t
          )
        );
      }
    });
  }

  function handleDragEnd() {
    setDraggedTask(null);
    draggedTaskRef.current = null;
    setDragOverColumn(null);
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide mb-4">
        Board
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.status);
          const isOver = dragOverColumn === col.status && draggedTask !== null;

          return (
            <div
              key={col.status}
              className={`flex-shrink-0 w-[272px] rounded-xl transition-colors duration-150 ${
                isOver
                  ? "bg-blue-50/80 ring-2 ring-blue-200 ring-inset"
                  : "bg-zinc-50/80"
              }`}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(col.status)}
            >
              {/* Column header */}
              <div className="px-3 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                  <h3 className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    {col.label}
                  </h3>
                </div>
                <span className="text-xs text-zinc-400 bg-white px-2 py-0.5 rounded-md font-medium shadow-sm border border-zinc-100">
                  {columnTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="px-2 pb-2 space-y-2 min-h-[80px]">
                {columnTasks.map((task) => {
                  const TypeIcon = TYPE_ICONS[task.type] || CheckSquare;
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white p-3 rounded-lg border border-zinc-200/80 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-zinc-300 transition-all duration-150 ${
                        draggedTask === task.id
                          ? "opacity-40 scale-[0.97] rotate-1"
                          : ""
                      }`}
                    >
                      <div className="flex items-start gap-2 mb-2.5">
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
                          className="text-sm font-medium text-zinc-900 leading-snug hover:text-blue-600 transition-colors"
                          onClick={(e) => e.stopPropagation()}
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
                            <div
                              className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center"
                              title={task.assignee.name}
                            >
                              <span className="text-[9px] font-medium text-white">
                                {task.assignee.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
