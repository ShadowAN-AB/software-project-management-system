"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import Link from "next/link";
import {
  Plus,
  ArrowRight,
  UserPlus,
  UserMinus,
  Play,
  CheckCircle2,
  Filter,
} from "lucide-react";

type ActivityItem = {
  id: string;
  action: string;
  details: string | null;
  createdAt: Date;
  user: { id: string; name: string } | null;
  project: { id: string; name: string; key: string } | null;
  task: { id: string; title: string } | null;
};

const ACTION_ICONS: Record<string, typeof Plus> = {
  TASK_CREATED: Plus,
  TASK_STATUS_CHANGED: ArrowRight,
  TASK_DELETED: CheckCircle2,
  MEMBER_ADDED: UserPlus,
  MEMBER_REMOVED: UserMinus,
  SPRINT_STARTED: Play,
  SPRINT_COMPLETED: CheckCircle2,
  PROJECT_CREATED: Plus,
};

const ACTION_COLORS: Record<string, string> = {
  TASK_CREATED: "bg-blue-500",
  TASK_STATUS_CHANGED: "bg-amber-500",
  TASK_DELETED: "bg-red-500",
  MEMBER_ADDED: "bg-emerald-500",
  MEMBER_REMOVED: "bg-zinc-500",
  SPRINT_STARTED: "bg-violet-500",
  SPRINT_COMPLETED: "bg-emerald-500",
  PROJECT_CREATED: "bg-blue-600",
};

function groupByDate(activities: ActivityItem[]) {
  const groups: Map<string, ActivityItem[]> = new Map();

  for (const a of activities) {
    const date = new Date(a.createdAt);
    let label: string;
    if (isToday(date)) label = "Today";
    else if (isYesterday(date)) label = "Yesterday";
    else label = format(date, "MMMM d, yyyy");

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(a);
  }

  return groups;
}

export function ActivityTimeline({
  activities,
  projects,
}: {
  activities: ActivityItem[];
  projects: { id: string; name: string }[];
}) {
  const [filterProject, setFilterProject] = useState<string>("all");

  const filtered =
    filterProject === "all"
      ? activities
      : activities.filter((a) => a.project?.id === filterProject);

  const grouped = groupByDate(filtered);

  return (
    <div className="space-y-6">
      {/* Filter */}
      {projects.length > 1 && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="text-sm rounded-lg border border-zinc-200 px-3 py-1.5 bg-white hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-zinc-400">
              No activity found for this filter
            </p>
          </CardContent>
        </Card>
      ) : (
        Array.from(grouped.entries()).map(([dateLabel, items]) => (
          <div key={dateLabel}>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
              {dateLabel}
            </h3>
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-zinc-50">
                  {items.map((a) => {
                    const Icon = ACTION_ICONS[a.action] || ArrowRight;
                    const color = ACTION_COLORS[a.action] || "bg-zinc-400";

                    return (
                      <li
                        key={a.id}
                        className="flex items-start gap-3 px-5 py-3.5 hover:bg-zinc-50/50 transition-colors"
                      >
                        <div
                          className={`h-7 w-7 rounded-full ${color} flex items-center justify-center flex-shrink-0 mt-0.5`}
                        >
                          <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-900">
                            <span className="font-medium">
                              {a.user?.name ?? "System"}
                            </span>{" "}
                            <span className="text-zinc-600">
                              {a.details || a.action.toLowerCase().replace("_", " ")}
                            </span>
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                            {a.project && (
                              <Link
                                href={`/projects/${a.project.id}`}
                                className="hover:text-blue-600 transition-colors font-mono"
                              >
                                {a.project.key}
                              </Link>
                            )}
                            {a.task && (
                              <>
                                <span>&middot;</span>
                                <Link
                                  href={`/tasks/${a.task.id}`}
                                  className="hover:text-blue-600 transition-colors truncate max-w-[200px]"
                                >
                                  {a.task.title}
                                </Link>
                              </>
                            )}
                            <span>&middot;</span>
                            <span>
                              {formatDistanceToNow(new Date(a.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
