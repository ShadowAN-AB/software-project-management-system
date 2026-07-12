import { getDashboardStats } from "@/services/dashboard-actions";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import {
  FolderKanban,
  ListTodo,
  CheckCircle2,
  Clock,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const [session, stats] = await Promise.all([auth(), getDashboardStats()]);

  if (!stats) return null;

  const statCards = [
    {
      label: "Projects",
      value: stats.projectCount,
      icon: FolderKanban,
      accent: "text-zinc-400 dark:text-zinc-500",
    },
    {
      label: "Total tasks",
      value: stats.totalTasks,
      icon: ListTodo,
      accent: "text-zinc-400 dark:text-zinc-500",
    },
    {
      label: "In progress",
      value: stats.tasksByStatus.IN_PROGRESS ?? 0,
      icon: Clock,
      accent: "text-zinc-400 dark:text-zinc-500",
    },
    {
      label: "Completed",
      value: stats.tasksByStatus.DONE ?? 0,
      icon: CheckCircle2,
      accent: "text-zinc-400 dark:text-zinc-500",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Here&apos;s what&apos;s happening across your projects
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {card.label}
                </p>
                <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mt-2">
                  {card.value}
                </p>
              </div>
              <card.icon
                className={`h-4 w-4 ${card.accent}`}
                strokeWidth={1.75}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                My tasks
              </h2>
              <Link
                href={`/w/${workspaceSlug}/tasks`}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                View all
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stats.myTasks.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <ListTodo className="h-8 w-8 text-zinc-200 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">No tasks assigned to you</p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {stats.myTasks.map((task) => (
                  <li
                    key={task.id}
                    className="px-6 py-3 hover:bg-zinc-50/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {task.project.name}
                        </p>
                      </div>
                      <StatusBadge status={task.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Active Sprints */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Active sprints
            </h2>
          </CardHeader>
          <CardContent className="p-0">
            {stats.activeSprints.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Clock className="h-8 w-8 text-zinc-200 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">No active sprints</p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {stats.activeSprints.map((sprint) => {
                  const progress =
                    sprint._count.tasks > 0
                      ? Math.round(
                          (sprint.completedTasks / sprint._count.tasks) * 100
                        )
                      : 0;
                  return (
                    <li key={sprint.id} className="px-6 py-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <Link
                          href={`/w/${workspaceSlug}/sprints/${sprint.id}`}
                          className="text-sm font-medium text-zinc-900 hover:text-blue-600 transition-colors"
                        >
                          {sprint.name}
                        </Link>
                        <span className="text-xs font-medium text-zinc-500">
                          {progress}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-zinc-900 dark:bg-zinc-100 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1.5">
                        {sprint.project.name} &middot; {sprint.completedTasks}/
                        {sprint._count.tasks} tasks
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Recent activity
              </h2>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recentActivity.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Activity className="h-8 w-8 text-zinc-200 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">No recent activity</p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {stats.recentActivity.map((log) => (
                  <li
                    key={log.id}
                    className="px-6 py-3 hover:bg-zinc-50/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex items-center gap-3">
                        <Avatar name={log.user.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-900">
                            <span className="font-medium">{log.user.name}</span>{" "}
                            <span className="text-zinc-500">{log.details}</span>
                          </p>
                          {log.project && (
                            <p className="text-xs text-zinc-400">
                              {log.project.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
