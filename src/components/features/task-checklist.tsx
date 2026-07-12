"use client";

import { useState, useTransition } from "react";
import {
  createSubtask,
  toggleSubtask,
  deleteSubtask,
  updateSubtaskTitle,
} from "@/services/subtask-actions";
import { decomposeTask } from "@/services/ai-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListChecks, Plus, X, Trash2, Check, Pencil, Sparkles, Loader2 } from "lucide-react";

type Subtask = {
  id: string;
  title: string;
  completed: boolean;
  order: number;
};

export function TaskChecklist({
  taskId,
  subtasks,
  aiEnabled = false,
}: {
  taskId: string;
  subtasks: Subtask[];
  aiEnabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiPending, setAiPending] = useState(false);

  async function handleDecompose() {
    setError(null);
    setAiPending(true);
    const result = await decomposeTask(taskId);
    setAiPending(false);
    if (!result.success) {
      setError(result.error);
    }
  }

  const completedCount = subtasks.filter((s) => s.completed).length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await createSubtask(taskId, newTitle);
      if (result.success) {
        setNewTitle("");
      } else {
        setError(result.error ?? "Failed to add item");
      }
    });
  }

  function handleToggle(subtaskId: string) {
    startTransition(async () => {
      await toggleSubtask(subtaskId);
    });
  }

  function handleDelete(subtaskId: string) {
    startTransition(async () => {
      await deleteSubtask(subtaskId);
    });
  }

  function startEditing(subtask: Subtask) {
    setEditingId(subtask.id);
    setEditTitle(subtask.title);
  }

  function handleEditSave(subtaskId: string) {
    if (!editTitle.trim()) return;
    startTransition(async () => {
      const result = await updateSubtaskTitle(subtaskId, editTitle);
      if (result.success) {
        setEditingId(null);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Checklist
            </h2>
            {totalCount > 0 && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                {completedCount}/{totalCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {aiEnabled && (
              <button
                onClick={handleDecompose}
                disabled={aiPending}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aiPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {aiPending ? "Generating…" : "AI decompose"}
              </button>
            )}
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-0.5"
            >
              {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showForm ? "Cancel" : "Add Item"}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {totalCount > 0 && (
          <div className="space-y-1">
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-zinc-900 dark:bg-zinc-100 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-zinc-400 text-right">{progress}%</p>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a checklist item..."
              autoFocus
              className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <Button size="sm" type="submit" loading={isPending}>
              Add
            </Button>
          </form>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}

        {subtasks.length === 0 && !showForm ? (
          <p className="text-xs text-zinc-400 italic">No checklist items yet</p>
        ) : (
          <div className="space-y-1">
            {subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center gap-2 group rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <button
                  onClick={() => handleToggle(subtask.id)}
                  disabled={isPending}
                  className={`flex-shrink-0 h-4.5 w-4.5 rounded border transition-colors flex items-center justify-center ${
                    subtask.completed
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-zinc-300 dark:border-zinc-600 hover:border-emerald-400"
                  }`}
                >
                  {subtask.completed && <Check className="h-3 w-3" />}
                </button>

                {editingId === subtask.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleEditSave(subtask.id);
                    }}
                    className="flex-1 flex gap-2"
                  >
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                      onBlur={() => handleEditSave(subtask.id)}
                      className="flex-1 rounded border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-0.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </form>
                ) : (
                  <span
                    onDoubleClick={() => startEditing(subtask)}
                    className={`flex-1 text-sm cursor-default select-none ${
                      subtask.completed
                        ? "line-through text-zinc-400 dark:text-zinc-500"
                        : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {subtask.title}
                  </span>
                )}

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEditing(subtask)}
                    className="p-1 text-zinc-400 hover:text-blue-500 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(subtask.id)}
                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
