"use client";

import { useActionState, useState } from "react";
import { createTask } from "@/services/task-actions";
import { generateTaskDescription } from "@/services/ai-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, ChevronDown, ChevronUp, Sparkles, Loader2 } from "lucide-react";
import type { ActionResult } from "@/types";

type Member = { id: string; name: string; email: string };
type Sprint = { id: string; name: string; status: string };

export function CreateTaskForm({
  projectId,
  members,
  sprints,
  aiEnabled = false,
}: {
  projectId: string;
  members: Member[];
  sprints: Sprint[];
  aiEnabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createTask,
    null
  );

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setTitle("");
      setDescription("");
      setAiError(null);
    }
  }

  async function handleGenerate() {
    setAiError(null);
    if (title.trim().length < 3) {
      setAiError("Enter a title first (min 3 characters).");
      return;
    }
    setAiPending(true);
    const result = await generateTaskDescription(title);
    setAiPending(false);
    if (result.success) {
      setDescription(result.data);
    } else {
      setAiError(result.error);
    }
  }

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Create Task</h2>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          <form action={action} className="space-y-4">
            <input type="hidden" name="projectId" value={projectId} />

            {state && !state.success && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {state.error}
              </div>
            )}

            <Input
              id="title"
              name="title"
              label="Title"
              placeholder="What needs to be done?"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                {aiEnabled && (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={aiPending}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {aiPending ? "Generating…" : "Generate with AI"}
                  </button>
                )}
              </div>
              <textarea
                id="description"
                name="description"
                rows={aiEnabled ? 5 : 2}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {aiError && (
                <p className="text-xs text-red-600">{aiError}</p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  name="status"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  defaultValue="BACKLOG"
                >
                  <option value="BACKLOG">Backlog</option>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Priority
                </label>
                <select
                  name="priority"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  defaultValue="MEDIUM"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Type
                </label>
                <select
                  name="type"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  defaultValue="TASK"
                >
                  <option value="TASK">Task</option>
                  <option value="FEATURE">Feature</option>
                  <option value="BUG">Bug</option>
                  <option value="IMPROVEMENT">Improvement</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Assignee
                </label>
                <select
                  name="assigneeId"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Sprint
                </label>
                <select
                  name="sprintId"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  defaultValue=""
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

              <Input id="dueDate" name="dueDate" type="date" label="Due Date" />
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={pending}>
                <Plus className="h-4 w-4 mr-1" />
                Create Task
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
