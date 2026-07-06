"use client";

import { useState } from "react";
import { LayoutGrid, GanttChartSquare } from "lucide-react";
import { KanbanBoard } from "@/components/features/kanban-board";
import { GanttChart } from "@/components/features/gantt-chart";
import type { TaskStatus } from "@prisma/client";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  type: string;
  dueDate: Date | null;
  createdAt: Date;
  assignee: { id: string; name: string } | null;
  _count: { comments: number };
  labels?: { id: string; label: { id: string; name: string; color: string } }[];
  sprintId: string | null;
};

type Sprint = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type Member = { id: string; name: string };

export function ProjectViewSwitcher({
  tasks,
  sprints,
  projectId,
  currentUserId,
  members = [],
}: {
  tasks: Task[];
  sprints: Sprint[];
  projectId: string;
  currentUserId: string;
  members?: Member[];
}) {
  const [view, setView] = useState<"kanban" | "gantt">("kanban");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setView("kanban")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "kanban"
              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Kanban
        </button>
        <button
          onClick={() => setView("gantt")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "gantt"
              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          }`}
        >
          <GanttChartSquare className="h-3.5 w-3.5" />
          Gantt
        </button>
      </div>

      {view === "kanban" ? (
        <KanbanBoard
          tasks={tasks}
          projectId={projectId}
          currentUserId={currentUserId}
          members={members}
        />
      ) : (
        <GanttChart tasks={tasks} sprints={sprints} />
      )}
    </div>
  );
}
