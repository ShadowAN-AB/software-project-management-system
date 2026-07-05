"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Users,
  ListTodo,
  Target,
} from "lucide-react";
import { formatDistanceToNow, format, differenceInDays } from "date-fns";

type SprintData = {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  _count: { tasks: number };
  tasks: { status: string }[];
};

type ActivityItem = {
  id: string;
  action: string;
  details: string | null;
  createdAt: Date;
  user: { name: string };
};

type OverviewData = {
  project: {
    id: string;
    name: string;
    startDate: Date | null;
    endDate: Date | null;
    members: { id: string; user: { id: string; name: string } }[];
  };
  statusCounts: Record<string, number>;
  totalTasks: number;
  doneTasks: number;
  progress: number;
  sprints: SprintData[];
  recentActivity: ActivityItem[];
  memberTaskMap: Record<string, number>;
  overdueCount: number;
};

export function ProjectOverview({ data }: { data: OverviewData }) {
  const {
    project,
    statusCounts,
    totalTasks,
    doneTasks,
    progress,
    sprints,
    recentActivity,
    memberTaskMap,
    overdueCount,
  } = data;

  const activeSprint = sprints.find((s) => s.status === "ACTIVE");
  const inProgressCount = statusCounts["IN_PROGRESS"] ?? 0;
  const todoCount = statusCounts["TODO"] ?? 0;

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Target className="h-5 w-5 text-blue-500" />}
          label="Progress"
          value={`${progress}%`}
          sub={`${doneTasks}/${totalTasks} tasks`}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-amber-500" />}
          label="In Progress"
          value={String(inProgressCount)}
          sub={`${todoCount} in queue`}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          label="Overdue"
          value={String(overdueCount)}
          sub={overdueCount > 0 ? "Needs attention" : "All on track"}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-violet-500" />}
          label="Team"
          value={String(project.members.length)}
          sub="Members"
        />
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-zinc-700">
              Overall Progress
            </span>
            <span className="text-sm font-bold text-zinc-900">{progress}%</span>
          </div>
          <div className="h-3 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background:
                  progress === 100
                    ? "linear-gradient(90deg, #22c55e, #16a34a)"
                    : progress > 60
                      ? "linear-gradient(90deg, #3b82f6, #6366f1)"
                      : "linear-gradient(90deg, #f97316, #eab308)",
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-400">
            <span>{statusCounts["BACKLOG"] ?? 0} Backlog</span>
            <span>{todoCount} To Do</span>
            <span>{inProgressCount} In Progress</span>
            <span>{statusCounts["IN_REVIEW"] ?? 0} In Review</span>
            <span>{doneTasks} Done</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sprint Timeline */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
              Sprint Timeline
            </h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {sprints.length === 0 ? (
              <p className="text-sm text-zinc-400">No sprints yet</p>
            ) : (
              sprints.map((sprint) => {
                const sprintDone = sprint.tasks.filter(
                  (t) => t.status === "DONE"
                ).length;
                const sprintTotal = sprint._count.tasks;
                const sprintProgress =
                  sprintTotal > 0
                    ? Math.round((sprintDone / sprintTotal) * 100)
                    : 0;
                const daysLeft = differenceInDays(
                  new Date(sprint.endDate),
                  new Date()
                );

                return (
                  <div
                    key={sprint.id}
                    className={`p-3 rounded-lg border ${
                      sprint.status === "ACTIVE"
                        ? "border-blue-200 bg-blue-50/50"
                        : sprint.status === "COMPLETED"
                          ? "border-emerald-200 bg-emerald-50/30"
                          : "border-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-zinc-900">
                        {sprint.name}
                      </span>
                      <StatusBadge status={sprint.status} />
                    </div>
                    <div className="text-xs text-zinc-500 mb-2">
                      {format(new Date(sprint.startDate), "MMM d")} –{" "}
                      {format(new Date(sprint.endDate), "MMM d, yyyy")}
                      {sprint.status === "ACTIVE" && daysLeft >= 0 && (
                        <span className="ml-2 text-blue-600 font-medium">
                          {daysLeft}d left
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${sprintProgress}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        {sprintDone}/{sprintTotal}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Team Distribution */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
              Task Distribution
            </h3>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.members.map((member) => {
              const taskCount = memberTaskMap[member.user.id] ?? 0;
              const maxTasks = Math.max(
                ...Object.values(memberTaskMap),
                1
              );
              const barWidth =
                maxTasks > 0
                  ? Math.round((taskCount / maxTasks) * 100)
                  : 0;

              return (
                <div key={member.id} className="flex items-center gap-3">
                  <div
                    className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center flex-shrink-0"
                    title={member.user.name}
                  >
                    <span className="text-[10px] font-medium text-white">
                      {member.user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-zinc-700 truncate">
                        {member.user.name}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {taskCount} tasks
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
            Recent Activity
          </h3>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-zinc-400">No activity yet</p>
          ) : (
            recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 py-1.5"
              >
                <div className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="h-3 w-3 text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-700">
                    <span className="font-medium">{activity.user.name}</span>{" "}
                    {activity.details || activity.action.toLowerCase().replace(/_/g, " ")}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {formatDistanceToNow(new Date(activity.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="text-lg font-bold text-zinc-900">{value}</p>
          <p className="text-[11px] text-zinc-400">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}
