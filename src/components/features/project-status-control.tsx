"use client";

import { useTransition } from "react";
import { updateProjectStatus } from "@/services/project-actions";
import { StatusBadge } from "@/components/ui/badge";

const STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;

export function ProjectStatusControl({
  projectId,
  status,
  canManage,
}: {
  projectId: string;
  status: string;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (!canManage) return <StatusBadge status={status} />;

  return (
    <label className="relative inline-block">
      <span className="sr-only">Project status</span>
      <select
        aria-label="Change project status"
        value={status}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await updateProjectStatus(projectId, next);
          });
        }}
        className="appearance-none pr-7 pl-2.5 py-0.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-colors cursor-pointer"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </label>
  );
}
