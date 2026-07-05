"use client";

import { useState, useTransition } from "react";
import { logTime, deleteTimeEntry } from "@/services/time-tracking-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Plus, X, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type TimeEntry = {
  id: string;
  minutes: number;
  description: string | null;
  date: Date;
  userId: string;
  user: { id: string; name: string };
};

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

export function TaskTimeTracking({
  taskId,
  timeEntries,
  currentUserId,
  currentUserRole,
}: {
  taskId: string;
  timeEntries: TimeEntry[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState<string | null>(null);

  const totalMinutes = timeEntries.reduce((sum, e) => sum + e.minutes, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const totalMins = (parseInt(hours || "0") * 60) + parseInt(minutes || "0");
    if (totalMins <= 0) {
      setError("Enter at least 1 minute");
      return;
    }

    startTransition(async () => {
      const result = await logTime(taskId, totalMins, description, date);
      if (result.success) {
        setShowForm(false);
        setHours("");
        setMinutes("");
        setDescription("");
        setDate(new Date().toISOString().split("T")[0]);
      } else {
        setError(result.error ?? "Failed to log time");
      }
    });
  }

  function handleDelete(entryId: string) {
    startTransition(async () => {
      await deleteTimeEntry(entryId);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Time Tracking
            </h2>
            {totalMinutes > 0 && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                Total: {formatMinutes(totalMinutes)}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-0.5"
          >
            {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {showForm ? "Cancel" : "Log Time"}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <form onSubmit={handleSubmit} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  Hours
                </label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  Minutes
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Description (optional)
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What did you work on?"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end">
              <Button size="sm" type="submit" loading={isPending}>
                Log Time
              </Button>
            </div>
          </form>
        )}

        {timeEntries.length === 0 && !showForm ? (
          <p className="text-xs text-zinc-400 italic">No time logged yet</p>
        ) : (
          <div className="space-y-1.5">
            {timeEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between group bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                    {formatMinutes(entry.minutes)}
                  </span>
                  <span className="text-xs text-zinc-400 truncate">
                    {entry.description || "No description"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 whitespace-nowrap">
                    {entry.user.name} &middot;{" "}
                    {formatDistanceToNow(new Date(entry.date), { addSuffix: true })}
                  </span>
                  {(entry.userId === currentUserId || currentUserRole === "ADMIN") && (
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
