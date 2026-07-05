"use client";

import { useState, useTransition } from "react";
import { updateTask, updateTaskStatus, deleteTask } from "@/services/task-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import {
  Calendar,
  User,
  Tag,
  Flag,
  Timer,
  Trash2,
  Bug,
  Sparkles,
  Wrench,
  CheckSquare,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useRouter } from "next/navigation";
import type { TaskStatus } from "@prisma/client";

type TaskData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
  assignee: { id: string; name: string; email: string } | null;
  creator: { id: string; name: string } | null;
  sprint: { id: string; name: string } | null;
  project: { id: string; name: string; key: string };
};

type Member = { id: string; name: string; email: string };
type Sprint = { id: string; name: string; status: string };

const STATUS_FLOW: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const TYPE_ICONS: Record<string, typeof Bug> = {
  BUG: Bug,
  FEATURE: Sparkles,
  IMPROVEMENT: Wrench,
  TASK: CheckSquare,
};

export function TaskDetail({
  task,
  members,
  sprints,
  currentUserId,
  currentUserRole,
}: {
  task: TaskData;
  members: Member[];
  sprints: Sprint[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");

  const TypeIcon = TYPE_ICONS[task.type] || CheckSquare;
  const canDelete = ["ADMIN", "PROJECT_MANAGER"].includes(currentUserRole) || task.creator?.id === currentUserId;

  function handleStatusChange(status: TaskStatus) {
    startTransition(async () => {
      await updateTaskStatus(task.id, status);
    });
  }

  function handleFieldUpdate(field: string, value: string | null) {
    startTransition(async () => {
      await updateTask(task.id, { [field]: value || null });
    });
  }

  function handleSaveEdit() {
    startTransition(async () => {
      await updateTask(task.id, { title, description: description || null });
      setIsEditing(false);
    });
  }

  function handleDelete() {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteTask(task.id);
      router.push(`/projects/${task.projectId}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xl font-bold text-zinc-900 bg-transparent border-b-2 border-blue-500 focus:outline-none pb-1"
                autoFocus
              />
            ) : (
              <div className="flex items-start gap-2.5">
                <TypeIcon
                  className={`h-5 w-5 mt-1 flex-shrink-0 ${
                    task.type === "BUG"
                      ? "text-red-500"
                      : task.type === "FEATURE"
                        ? "text-violet-500"
                        : "text-zinc-400"
                  }`}
                  strokeWidth={1.75}
                />
                <h1
                  className="text-xl font-bold text-zinc-900 tracking-tight cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => setIsEditing(true)}
                >
                  {task.title}
                </h1>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-400">
              <span className="font-mono">{task.project.key}</span>
              <span>&middot;</span>
              <span>
                Created{" "}
                {formatDistanceToNow(new Date(task.createdAt), {
                  addSuffix: true,
                })}
              </span>
              {task.creator && (
                <>
                  <span>&middot;</span>
                  <span>by {task.creator.name}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button size="sm" onClick={handleSaveEdit} loading={isPending}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setTitle(task.title);
                    setDescription(task.description ?? "");
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              canDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  className="text-zinc-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Flow */}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
            Status
          </p>
          <div className="flex items-center gap-1">
            {STATUS_FLOW.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
                  task.status === s
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
            Description
          </p>
          {isEditing ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Add a description..."
            />
          ) : (
            <div
              className="text-sm text-zinc-600 leading-relaxed cursor-pointer hover:bg-zinc-50 rounded-lg p-3 -m-3 transition-colors min-h-[60px]"
              onClick={() => setIsEditing(true)}
            >
              {task.description || (
                <span className="text-zinc-400 italic">
                  Click to add a description...
                </span>
              )}
            </div>
          )}
        </div>

        {/* Fields Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Priority */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <Flag className="h-3.5 w-3.5" strokeWidth={1.75} />
              Priority
            </label>
            <select
              value={task.priority}
              onChange={(e) => handleFieldUpdate("priority", e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <Tag className="h-3.5 w-3.5" strokeWidth={1.75} />
              Type
            </label>
            <select
              value={task.type}
              onChange={(e) => handleFieldUpdate("type", e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="TASK">Task</option>
              <option value="FEATURE">Feature</option>
              <option value="BUG">Bug</option>
              <option value="IMPROVEMENT">Improvement</option>
            </select>
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <User className="h-3.5 w-3.5" strokeWidth={1.75} />
              Assignee
            </label>
            <select
              value={task.assignee?.id ?? ""}
              onChange={(e) =>
                handleFieldUpdate("assigneeId", e.target.value || null)
              }
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sprint */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <Timer className="h-3.5 w-3.5" strokeWidth={1.75} />
              Sprint
            </label>
            <select
              value={task.sprint?.id ?? ""}
              onChange={(e) =>
                handleFieldUpdate("sprintId", e.target.value || null)
              }
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="">No Sprint</option>
              {sprints
                .filter((s) => s.status !== "COMPLETED")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
              Due Date
            </label>
            <input
              type="date"
              value={
                task.dueDate
                  ? format(new Date(task.dueDate), "yyyy-MM-dd")
                  : ""
              }
              onChange={(e) =>
                handleFieldUpdate("dueDate", e.target.value || null)
              }
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
