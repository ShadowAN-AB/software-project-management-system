"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

type ReportsData = {
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  tasksByType: Record<string, number>;
  projectsByStatus: Record<string, number>;
  dailyTrend: { date: string; created: number; completed: number }[];
  topAssignees: { name: string; count: number }[];
  sprintStats: {
    name: string;
    project: string;
    total: number;
    completed: number;
    status: string;
  }[];
  overdueTasks: number;
};

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: "bg-zinc-400",
  TODO: "bg-blue-500",
  IN_PROGRESS: "bg-amber-500",
  IN_REVIEW: "bg-violet-500",
  DONE: "bg-emerald-500",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-zinc-400",
  MEDIUM: "bg-blue-500",
  HIGH: "bg-amber-500",
  CRITICAL: "bg-red-500",
};

const TYPE_COLORS: Record<string, string> = {
  TASK: "bg-zinc-500",
  FEATURE: "bg-violet-500",
  BUG: "bg-red-500",
  IMPROVEMENT: "bg-cyan-500",
};

function BarChart({
  data,
  colors,
  labelFormatter,
}: {
  data: Record<string, number>;
  colors: Record<string, string>;
  labelFormatter?: (key: string) => string;
}) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        const barWidth = max > 0 ? (value / max) * 100 : 0;
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-zinc-600">
                {labelFormatter ? labelFormatter(key) : key.replace("_", " ")}
              </span>
              <span className="text-xs text-zinc-400">
                {value} ({pct}%)
              </span>
            </div>
            <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  colors[key] ?? "bg-zinc-400"
                }`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniTrend({
  data,
}: {
  data: { date: string; created: number; completed: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-400 text-center py-8">
        No activity in the last 30 days
      </p>
    );
  }

  const max = Math.max(...data.map((d) => Math.max(d.created, d.completed)), 1);
  const barWidth = Math.max(100 / Math.max(data.length, 1) - 1, 2);

  return (
    <div>
      <div className="flex items-end gap-[2px] h-[120px]">
        {data.slice(-14).map((d) => (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center gap-[1px] justify-end h-full"
          >
            <div
              className="w-full bg-emerald-400 rounded-t-sm transition-all duration-500"
              style={{ height: `${(d.completed / max) * 100}%`, minHeight: d.completed > 0 ? "2px" : "0" }}
              title={`${d.completed} completed`}
            />
            <div
              className="w-full bg-blue-400 rounded-t-sm transition-all duration-500"
              style={{ height: `${(d.created / max) * 100}%`, minHeight: d.created > 0 ? "2px" : "0" }}
              title={`${d.created} created`}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-blue-400" /> Created
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-emerald-400" /> Completed
        </span>
      </div>
    </div>
  );
}

export function ReportsCharts({ data }: { data: ReportsData }) {
  return (
    <div className="space-y-6">
      {/* Row 1: Status + Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Tasks by Status
            </h3>
          </CardHeader>
          <CardContent>
            <BarChart data={data.tasksByStatus} colors={STATUS_COLORS} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Tasks by Priority
            </h3>
          </CardHeader>
          <CardContent>
            <BarChart data={data.tasksByPriority} colors={PRIORITY_COLORS} />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Trend + Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Activity Trend (Last 14 Days)
            </h3>
          </CardHeader>
          <CardContent>
            <MiniTrend data={data.dailyTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Tasks by Type
            </h3>
          </CardHeader>
          <CardContent>
            <BarChart data={data.tasksByType} colors={TYPE_COLORS} />
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top Assignees + Sprint Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Top Team Members
            </h3>
          </CardHeader>
          <CardContent>
            {data.topAssignees.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-6">
                No assigned tasks yet
              </p>
            ) : (
              <div className="space-y-3">
                {data.topAssignees.map((a, i) => {
                  const max = data.topAssignees[0]?.count ?? 1;
                  return (
                    <div key={a.name} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-white">
                          {a.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-zinc-700 truncate">
                            {a.name}
                          </span>
                          <span className="text-xs text-zinc-400 ml-2">
                            {a.count} tasks
                          </span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
                            style={{ width: `${(a.count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Sprint Health
            </h3>
          </CardHeader>
          <CardContent>
            {data.sprintStats.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-6">
                No sprints yet
              </p>
            ) : (
              <div className="space-y-4">
                {data.sprintStats.map((s) => {
                  const pct =
                    s.total > 0
                      ? Math.round((s.completed / s.total) * 100)
                      : 0;
                  return (
                    <div key={s.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-xs font-medium text-zinc-700">
                            {s.name}
                          </span>
                          <span className="text-xs text-zinc-400 ml-1.5">
                            {s.project}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-zinc-500">
                          {s.completed}/{s.total} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct === 100
                              ? "bg-emerald-500"
                              : pct >= 50
                                ? "bg-blue-500"
                                : "bg-amber-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
