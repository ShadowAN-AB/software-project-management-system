"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { DueDateBadge } from "@/components/ui/badge";
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
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const totalActive = members.reduce((a, m) => a + m.activeTaskCount, 0);
  const totalCompleted = members.reduce((a, m) => a + m.completedThisWeek, 0);
  const totalOverdue = members.reduce((a, m) => a + m.overdueTasks, 0);
  const avgLoad = members.length > 0 ? (totalActive / members.length).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-zinc-500">Team Size</p>
              <p className="text-lg font-bold text-zinc-900">{members.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-zinc-500">Avg Load</p>
              <p className="text-lg font-bold text-zinc-900">{avgLoad}</p>
              <p className="text-[11px] text-zinc-400">tasks/person</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-xs text-zinc-500">Completed</p>
              <p className="text-lg font-bold text-zinc-900">{totalCompleted}</p>
              <p className="text-[11px] text-zinc-400">this week</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-xs text-zinc-500">Overdue</p>
              <p className="text-lg font-bold text-zinc-900">{totalOverdue}</p>
              <p className="text-[11px] text-zinc-400">across team</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workload Heatmap */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
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
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-medium text-white">
                          {member.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3 text-zinc-400" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-zinc-400" />
                            )}
                            <span className="text-sm font-medium text-zinc-900 truncate">
                              {member.name}
                            </span>
                            <span className="text-xs text-zinc-400">
                              {member.role.replace("_", " ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {member.overdueTasks > 0 && (
                              <span className="text-xs text-red-500 font-medium">
                                {member.overdueTasks} overdue
                              </span>
                            )}
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${level.bg} ${level.color}`}
                            >
                              {level.label}
                            </span>
                            <span className="text-xs text-zinc-500 font-mono w-8 text-right">
                              {member.activeTaskCount}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
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
                          href={`/tasks/${task.id}`}
                          className="flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-zinc-50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono text-zinc-400">
                              {task.project.key}
                            </span>
                            <span className="text-xs text-zinc-700 truncate">
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
          <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
            Priority Breakdown
          </h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500">
                    Member
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-red-500">
                    Critical
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-orange-500">
                    High
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-amber-500">
                    Medium
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-zinc-400">
                    Low
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-zinc-500">
                    Total
                  </th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-emerald-500">
                    Done/wk
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-zinc-50 hover:bg-zinc-50"
                  >
                    <td className="py-2 px-3 text-zinc-700 font-medium">
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
                    <td className="text-center py-2 px-3 font-semibold text-zinc-900">
                      {member.activeTaskCount}
                    </td>
                    <td className="text-center py-2 px-3 text-emerald-600 font-medium">
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
    return <span className="text-zinc-300">–</span>;
  return <span className="text-zinc-700">{count}</span>;
}
