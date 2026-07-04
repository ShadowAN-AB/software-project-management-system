"use client";

import { useState, useTransition } from "react";
import { updateTaskStatus } from "@/services/task-actions";
import { PriorityBadge } from "@/components/ui/badge";
import { User, MessageSquare, Bug, Sparkles, Wrench, CheckSquare } from "lucide-react";
import type { TaskStatus } from "@prisma/client";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  type: string;
  assignee: { id: string; name: string } | null;
  _count: { comments: number };
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
}: {
  tasks: Task[];
  projectId: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [, startTransition] = useTransition();

  function handleDragStart(taskId: string) {
    setDraggedTask(taskId);
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
                        <p className="text-sm font-medium text-zinc-900 leading-snug">
                          {task.title}
                        </p>
                      </div>
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
