"use client";

import { useState, useTransition } from "react";
import { addProjectMember, removeProjectMember } from "@/services/project-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, X, Users, ChevronDown } from "lucide-react";

type Member = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  DEVELOPER: "Developer",
  TESTER: "Tester",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "text-amber-700 bg-amber-50",
  PROJECT_MANAGER: "text-violet-700 bg-violet-50",
  DEVELOPER: "text-blue-700 bg-blue-50",
  TESTER: "text-emerald-700 bg-emerald-50",
};

export function TeamManagement({
  projectId,
  members,
  allUsers,
  canManage,
  currentUserId,
}: {
  projectId: string;
  members: Member[];
  allUsers: User[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showPicker, setShowPicker] = useState(false);
  const [selectedRole, setSelectedRole] = useState("DEVELOPER");
  const [error, setError] = useState<string | null>(null);

  const memberUserIds = new Set(members.map((m) => m.user.id));
  const availableUsers = allUsers.filter((u) => !memberUserIds.has(u.id));

  function handleAdd(userId: string) {
    setError(null);
    startTransition(async () => {
      const result = await addProjectMember(projectId, userId, selectedRole);
      if (!result.success) {
        setError(result.error ?? "Failed to add member");
      } else {
        setShowPicker(false);
      }
    });
  }

  function handleRemove(memberId: string, userName: string) {
    if (!confirm(`Remove ${userName} from this project?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await removeProjectMember(projectId, memberId);
      if (!result.success) {
        setError(result.error ?? "Failed to remove member");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
              Team Members
            </h2>
            <span className="text-xs text-zinc-400">({members.length})</span>
          </div>
          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowPicker(!showPicker)}
              className="gap-1.5 text-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Member
            </Button>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-2">
            {error}
          </p>
        )}
      </CardHeader>

      {/* Add member picker */}
      {showPicker && canManage && (
        <div className="px-6 pb-4 border-b border-zinc-100">
          <div className="bg-zinc-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-600">
                Role in project:
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="text-xs font-medium rounded-md border border-zinc-200 px-2 py-1 bg-white"
              >
                <option value="DEVELOPER">Developer</option>
                <option value="TESTER">Tester</option>
                <option value="PROJECT_MANAGER">Project Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {availableUsers.length === 0 ? (
              <p className="text-xs text-zinc-400 py-2">
                All users are already members of this project.
              </p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {availableUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleAdd(user.id)}
                    disabled={isPending}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white transition-colors text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-white">
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {user.name}
                        </p>
                        <p className="text-xs text-zinc-400">{user.email}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        ROLE_COLORS[user.role] ?? ROLE_COLORS.DEVELOPER
                      }`}
                    >
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <CardContent className="p-0">
        <ul className="divide-y divide-zinc-100">
          {members.map((member) => {
            const isSelf = member.user.id === currentUserId;
            return (
              <li
                key={member.id}
                className={`px-6 py-3 flex items-center justify-between ${
                  isPending ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">
                      {member.user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {member.user.name}
                      {isSelf && (
                        <span className="ml-1 text-xs text-zinc-400">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-400">{member.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      ROLE_COLORS[member.role] ?? ROLE_COLORS.DEVELOPER
                    }`}
                  >
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                  {canManage && !isSelf && (
                    <button
                      onClick={() =>
                        handleRemove(member.id, member.user.name)
                      }
                      className="p-1 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove from project"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
