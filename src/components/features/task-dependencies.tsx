"use client";

import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import { addDependency, removeDependency } from "@/services/dependency-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitBranch, X, Plus, ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import Link from "next/link";

type DepTask = { id: string; title: string; status: string };
type Dependency = { id: string; blockerTask?: DepTask; blockedTask?: DepTask };
type ProjectTask = { id: string; title: string };

export function TaskDependencies({
  taskId,
  blockedBy,
  blocks,
  projectTasks,
}: {
  taskId: string;
  blockedBy: Dependency[];
  blocks: Dependency[];
  projectTasks: ProjectTask[];
}) {
  const workspaceSlug = useParams().workspaceSlug as string;
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState<"blockedBy" | "blocks" | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Exclude tasks already in dependencies + current task
  const existingIds = new Set([
    taskId,
    ...blockedBy.map((d) => d.blockerTask!.id),
    ...blocks.map((d) => d.blockedTask!.id),
  ]);
  const availableTasks = projectTasks.filter(
    (t) => !existingIds.has(t.id) && t.title.toLowerCase().includes(search.toLowerCase())
  );

  function handleAdd(relatedTaskId: string) {
    setError(null);
    startTransition(async () => {
      const result =
        showAdd === "blockedBy"
          ? await addDependency(taskId, relatedTaskId)
          : await addDependency(relatedTaskId, taskId);

      if (!result.success) {
        setError(result.error ?? "Failed to add dependency");
      } else {
        setShowAdd(null);
        setSearch("");
      }
    });
  }

  function handleRemove(depId: string) {
    startTransition(async () => {
      await removeDependency(depId);
    });
  }

  const hasBlockers = blockedBy.some(
    (d) => d.blockerTask!.status !== "DONE"
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Dependencies
            </h2>
            {hasBlockers && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                <AlertCircle className="h-3 w-3" />
                Blocked
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Blocked By */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
              <ArrowLeft className="h-3 w-3" />
              Blocked by ({blockedBy.length})
            </p>
            <button
              onClick={() => { setShowAdd(showAdd === "blockedBy" ? null : "blockedBy"); setSearch(""); setError(null); }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
          {blockedBy.length === 0 && !showAdd && (
            <p className="text-xs text-zinc-400 italic">No blockers</p>
          )}
          <div className="space-y-1.5">
            {blockedBy.map((dep) => (
              <div key={dep.id} className="flex items-center justify-between group bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Link
                    href={`/w/${workspaceSlug}/tasks/${dep.blockerTask!.id}`}
                    className="text-sm text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                  >
                    {dep.blockerTask!.title}
                  </Link>
                  <StatusBadge status={dep.blockerTask!.status} />
                </div>
                <button
                  onClick={() => handleRemove(dep.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Blocks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
              <ArrowRight className="h-3 w-3" />
              Blocks ({blocks.length})
            </p>
            <button
              onClick={() => { setShowAdd(showAdd === "blocks" ? null : "blocks"); setSearch(""); setError(null); }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
          {blocks.length === 0 && !showAdd && (
            <p className="text-xs text-zinc-400 italic">Not blocking anything</p>
          )}
          <div className="space-y-1.5">
            {blocks.map((dep) => (
              <div key={dep.id} className="flex items-center justify-between group bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Link
                    href={`/w/${workspaceSlug}/tasks/${dep.blockedTask!.id}`}
                    className="text-sm text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                  >
                    {dep.blockedTask!.title}
                  </Link>
                  <StatusBadge status={dep.blockedTask!.status} />
                </div>
                <button
                  onClick={() => handleRemove(dep.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add dependency picker */}
        {showAdd && (
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 space-y-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
            <div className="max-h-40 overflow-y-auto space-y-1">
              {availableTasks.length === 0 ? (
                <p className="text-xs text-zinc-400 py-2 text-center">No matching tasks</p>
              ) : (
                availableTasks.slice(0, 10).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleAdd(t.id)}
                    disabled={isPending}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors disabled:opacity-50"
                  >
                    {t.title}
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowAdd(null); setError(null); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
