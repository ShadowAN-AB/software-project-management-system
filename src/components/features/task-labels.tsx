"use client";

import { useState, useTransition } from "react";
import {
  addLabelToTask,
  removeLabelFromTask,
  createLabel,
} from "@/services/label-actions";
import { Button } from "@/components/ui/button";
import { Tag, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";

type Label = { id: string; name: string; color: string };
type TaskLabelItem = { id: string; label: Label };

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7",
  "#ec4899", "#78716c",
];

export function TaskLabels({
  taskId,
  projectId,
  taskLabels,
  projectLabels,
}: {
  taskId: string;
  projectId: string;
  taskLabels: TaskLabelItem[];
  projectLabels: Label[];
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[6]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const appliedIds = new Set(taskLabels.map((tl) => tl.label.id));
  const available = projectLabels.filter((l) => !appliedIds.has(l.id));

  function handleAdd(labelId: string) {
    startTransition(async () => {
      await addLabelToTask(taskId, labelId);
      router.refresh();
    });
  }

  function handleRemove(labelId: string) {
    startTransition(async () => {
      await removeLabelFromTask(taskId, labelId);
      router.refresh();
    });
  }

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await createLabel(projectId, newName, newColor);
      if (result.success) {
        setNewName("");
        setShowCreate(false);
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Tag className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.75} />
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          Labels
        </span>
      </div>

      {/* Applied labels */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {taskLabels.map((tl) => (
          <span
            key={tl.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-white"
            style={{ backgroundColor: tl.label.color }}
          >
            {tl.label.name}
            <button
              onClick={() => handleRemove(tl.label.id)}
              className="hover:opacity-70 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs text-zinc-400 border border-dashed border-zinc-300 hover:border-zinc-400 hover:text-zinc-500 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {/* Picker dropdown */}
      {showPicker && (
        <div className="border border-zinc-200 rounded-lg p-2 bg-white shadow-sm space-y-1">
          {available.length > 0 ? (
            available.map((label) => (
              <button
                key={label.id}
                onClick={() => handleAdd(label.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-zinc-50 transition-colors text-left"
              >
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </button>
            ))
          ) : (
            <p className="text-xs text-zinc-400 px-2 py-1">
              No more labels available
            </p>
          )}

          <div className="border-t border-zinc-100 pt-1 mt-1">
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Create new label
              </button>
            ) : (
              <div className="space-y-2 px-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Label name"
                  className="w-full text-xs rounded border border-zinc-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <div className="flex gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`h-5 w-5 rounded-full transition-all ${
                        newColor === c
                          ? "ring-2 ring-offset-1 ring-zinc-400 scale-110"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={handleCreate} loading={isPending}>
                    Create
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
