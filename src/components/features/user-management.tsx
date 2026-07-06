"use client";

import { useState, useTransition } from "react";
import { updateUserRole, deleteUser } from "@/services/admin-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Shield, FolderKanban, ListTodo } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  _count: {
    assignedTasks: number;
    createdTasks: number;
    projectMemberships: number;
  };
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  DEVELOPER: "Developer",
  TESTER: "Tester",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "text-amber-600 bg-amber-50 border-amber-200",
  PROJECT_MANAGER: "text-violet-600 bg-violet-50 border-violet-200",
  DEVELOPER: "text-blue-600 bg-blue-50 border-blue-200",
  TESTER: "text-emerald-600 bg-emerald-50 border-emerald-200",
};

export function UserManagement({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRoleChange(userId: string, role: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateUserRole(
        userId,
        role as "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER" | "TESTER"
      );
      if (!result.success) setError(result.error ?? "Failed to update role");
    });
  }

  function handleDelete(userId: string, userName: string) {
    if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteUser(userId);
      if (!result.success) setError(result.error ?? "Failed to delete user");
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            User Management
          </h2>
          <span className="text-xs text-zinc-400">
            {users.length} user{users.length !== 1 ? "s" : ""}
          </span>
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-2 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-6 py-3">
                  User
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-6 py-3">
                  Role
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-6 py-3">
                  Activity
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-6 py-3">
                  Joined
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-6 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <tr
                    key={user.id}
                    className={`hover:bg-zinc-50/50 transition-colors ${
                      isPending ? "opacity-60" : ""
                    }`}
                  >
                    {/* User info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">
                            {user.name}
                            {isSelf && (
                              <span className="ml-1.5 text-xs text-zinc-400">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-zinc-400 truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      {isSelf ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border ${
                            ROLE_COLORS[user.role] ?? ROLE_COLORS.DEVELOPER
                          }`}
                        >
                          <Shield className="h-3 w-3" strokeWidth={2} />
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(user.id, e.target.value)
                          }
                          className="text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 bg-white dark:bg-zinc-800 dark:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="PROJECT_MANAGER">
                            Project Manager
                          </option>
                          <option value="DEVELOPER">Developer</option>
                          <option value="TESTER">Tester</option>
                        </select>
                      )}
                    </td>

                    {/* Activity */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1" title="Projects">
                          <FolderKanban className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {user._count.projectMemberships}
                        </span>
                        <span className="flex items-center gap-1" title="Assigned tasks">
                          <ListTodo className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {user._count.assignedTasks}
                        </span>
                      </div>
                    </td>

                    {/* Joined */}
                    <td className="px-6 py-4">
                      <span className="text-xs text-zinc-400">
                        {formatDistanceToNow(new Date(user.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      {!isSelf && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(user.id, user.name)}
                          className="text-zinc-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
