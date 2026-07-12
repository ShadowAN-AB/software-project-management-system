"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { DueDateBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Users,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

type ActiveTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  project: { name: string; key: string };
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  activeTasks: ActiveTask[];
  activeTaskCount: number;
  completedThisWeek: number;
  projects: { id: string; name: string }[];
  tasksByPriority: Record<string, number>;
  overdueTasks: number;
};

const CAPACITY_THRESHOLD = 8;

function getWorkloadLevel(count: number) {
  if (count === 0) return { label: "Available", color: "text-zinc-400", bg: "bg-zinc-100" };
  if (count <= 3) return { label: "Light", color: "text-emerald-600", bg: "bg-emerald-50" };
  if (count <= CAPACITY_THRESHOLD) return { label: "Moderate", color: "text-amber-600", bg: "bg-amber-50" };
  return { label: "Heavy", color: "text-red-600", bg: "bg-red-50" };
}

export function TeamWorkload({ members }: { members: TeamMember[] }) {
  const workspaceSlug = useParams().workspaceSlug as string;
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const totalActive = members.reduce((a, m) => a + m.activeTaskCount, 0);
  const totalCompleted = members.reduce((a, m) => a + m.completedThisWeek, 0);
  const totalOverdue = members.reduce((a, m) => a + m.overdueTasks, 0);
  const avgLoad = members.length > 0 ? (totalActive / members.length).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Team size", value: members.length, icon: Users },
          { label: "Avg load", value: avgLoad, icon: TrendingUp, hint: "tasks/person" },
          { label: "Completed", value: totalCompleted, icon: CheckCircle, hint: "this week" },
          { label: "Overdue", value: totalOverdue, icon: AlertTriangle, hint: "across team" },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {card.label}
                </p>
                <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mt-2">
                  {card.value}
                </p>
                {card.hint && (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                    {card.hint}
                  </p>
                )}
              </div>
              <card.icon
                className="h-4 w-4 text-zinc-400 dark:text-zinc-500"
                strokeWidth={1.75}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workload Heatmap */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Capacity Overview
          </h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => {
              const level = getWorkloadLevel(member.activeTaskCount);
              const barWidth = Math.min(
                (member.activeTaskCount / CAPACITY_THRESHOLD) * 100,
                100
              );
              const isExpanded = expandedMember === member.id;

              return (
                <div key={member.id}>
                  <button
                    onClick={() =>
                      setExpandedMember(isExpanded ? null : member.id)
                    }
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3 text-zinc-400" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-zinc-400" />
                            )}
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {member.name}
                            </span>
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">
                              {member.role.replace("_", " ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {member.overdueTasks > 0 && (
                              <span className="text-xs text-red-500 dark:text-red-400 font-medium">
                                {member.overdueTasks} overdue
                              </span>
                            )}
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${level.bg} ${level.color}`}
                            >
                              {level.label}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono w-8 text-right">
                              {member.activeTaskCount}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              member.activeTaskCount > CAPACITY_THRESHOLD
                                ? "bg-red-500"
                                : member.activeTaskCount > 5
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded task list */}
                  {isExpanded && member.activeTasks.length > 0 && (
                    <div className="ml-11 mt-2 space-y-1 pb-2">
                      {member.activeTasks.map((task) => (
                        <Link
                          key={task.id}
                          href={`/w/${workspaceSlug}/tasks/${task.id}`}
                          className="flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                              {task.project.key}
                            </span>
                            <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">
                              {task.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2">
                            {task.dueDate && (
                              <DueDateBadge dueDate={task.dueDate} compact />
                            )}
                            <PriorityBadge priority={task.priority} />
                            <StatusBadge status={task.status} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Priority Breakdown */}
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Priority Breakdown
          </h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Member
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    Critical
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    High
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Medium
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    Low
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Total
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Done/wk
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300 font-medium">
                      {member.name}
                    </td>
                    <td className="text-center py-2 px-3">
                      <PriorityCell count={member.tasksByPriority.CRITICAL} />
                    </td>
                    <td className="text-center py-2 px-3">
                      <PriorityCell count={member.tasksByPriority.HIGH} />
                    </td>
                    <td className="text-center py-2 px-3">
                      <PriorityCell count={member.tasksByPriority.MEDIUM} />
                    </td>
                    <td className="text-center py-2 px-3">
                      <PriorityCell count={member.tasksByPriority.LOW} />
                    </td>
                    <td className="text-center py-2 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      {member.activeTaskCount}
                    </td>
                    <td className="text-center py-2 px-3 text-zinc-900 dark:text-zinc-100 font-medium">
                      {member.completedThisWeek}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PriorityCell({ count }: { count: number }) {
  if (count === 0)
    return <span className="text-zinc-300 dark:text-zinc-700">–</span>;
  return <span className="text-zinc-700 dark:text-zinc-300">{count}</span>;
}
