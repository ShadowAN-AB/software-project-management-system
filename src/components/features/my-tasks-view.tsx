"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge, PriorityBadge, DueDateBadge } from "@/components/ui/badge";
import { ListTodo, Sparkles, Loader2, X } from "lucide-react";
import { searchMyTasks, type SearchedTask } from "@/services/ai-actions";

type Task = SearchedTask;

export function MyTasksView({
  tasks,
  aiEnabled,
}: {
  tasks: Task[];
  aiEnabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Task[] | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setPending(true);
    const result = await searchMyTasks(query);
    setPending(false);
    if (result.success) {
      setResults(result.data.tasks);
      setActiveFilter(formatFilter(result.data.filter));
    } else {
      setError(result.error);
    }
  }

  function clearSearch() {
    setQuery("");
    setResults(null);
    setError(null);
    setActiveFilter(null);
  }

  const grouped = {
    active: tasks.filter((t) => !["DONE", "BACKLOG"].includes(t.status)),
    backlog: tasks.filter((t) => t.status === "BACKLOG"),
    done: tasks.filter((t) => t.status === "DONE"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Tasks</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""} assigned to you
        </p>
      </div>

      {aiEnabled && (
        <form onSubmit={handleSearch} className="relative">
          <Sparkles className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask in plain English — e.g. 'overdue high priority bugs'"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 pl-9 pr-24 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {results !== null && (
              <button
                type="button"
                onClick={clearSearch}
                className="p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={pending || query.trim().length < 2}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Search
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {results !== null ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Results ({results.length})
              </h2>
              {activeFilter && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {activeFilter}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {results.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No tasks match this query.
              </p>
            ) : (
              <TaskList tasks={results} />
            )}
          </CardContent>
        </Card>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ListTodo className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">No tasks assigned to you yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {grouped.active.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Active ({grouped.active.length})
                </h2>
              </CardHeader>
              <CardContent className="p-0">
                <TaskList tasks={grouped.active} />
              </CardContent>
            </Card>
          )}

          {grouped.backlog.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Backlog ({grouped.backlog.length})
                </h2>
              </CardHeader>
              <CardContent className="p-0">
                <TaskList tasks={grouped.backlog} />
              </CardContent>
            </Card>
          )}

          {grouped.done.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Done ({grouped.done.length})
                </h2>
              </CardHeader>
              <CardContent className="p-0">
                <TaskList tasks={grouped.done} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function TaskList({ tasks }: { tasks: Task[] }) {
  const workspaceSlug = useParams().workspaceSlug as string;
  return (
    <ul className="divide-y divide-gray-100 dark:divide-zinc-700">
      {tasks.map((task) => (
        <li key={task.id} className="px-6 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
          <Link href={`/w/${workspaceSlug}/tasks/${task.id}`}>
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{task.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">{task.project.key}</span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">{task.project.name}</span>
                  {task.sprint && (
                    <span className="text-xs text-blue-500">{task.sprint.name}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                {task.dueDate && task.status !== "DONE" && (
                  <DueDateBadge dueDate={task.dueDate} compact />
                )}
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
                <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                  {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function formatFilter(filter: {
  status?: string[];
  priority?: string[];
  type?: string[];
  overdue?: boolean;
  dueWithinDays?: number;
  titleContains?: string;
}): string | null {
  const parts: string[] = [];
  if (filter.status?.length) parts.push(`status: ${filter.status.join(", ")}`);
  if (filter.priority?.length) parts.push(`priority: ${filter.priority.join(", ")}`);
  if (filter.type?.length) parts.push(`type: ${filter.type.join(", ")}`);
  if (filter.overdue) parts.push("overdue");
  if (filter.dueWithinDays) parts.push(`due within ${filter.dueWithinDays}d`);
  if (filter.titleContains) parts.push(`title contains "${filter.titleContains}"`);
  return parts.length ? parts.join(" · ") : null;
}
