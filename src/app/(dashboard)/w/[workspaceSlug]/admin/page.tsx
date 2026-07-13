import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requireWorkspaceMember } from "@/lib/authorization";
import { getAdminStats, getAdminUsers } from "@/services/admin-actions";
import { getInvitations } from "@/services/invite-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Users, FolderKanban, ListTodo, ShieldCheck } from "lucide-react";
import { UserManagement } from "@/components/features/user-management";
import { InviteManagement } from "@/components/features/invite-management";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const ctx = await requireWorkspaceMember(workspaceSlug, session.user.id);
  if (ctx.role !== "ADMIN") redirect(`/w/${workspaceSlug}/dashboard`);

  const [stats, users, invitations] = await Promise.all([
    getAdminStats(),
    getAdminUsers(),
    getInvitations(),
  ]);

  const statCards = [
    {
      label: "Members",
      value: stats.userCount,
      icon: Users,
      accent: "text-blue-500",
    },
    {
      label: "Projects",
      value: stats.projectCount,
      icon: FolderKanban,
      accent: "text-emerald-500",
    },
    {
      label: "Tasks",
      value: stats.taskCount,
      icon: ListTodo,
      accent: "text-violet-500",
    },
    {
      label: "Admins",
      value: stats.roleDistribution.ADMIN ?? 0,
      icon: ShieldCheck,
      accent: "text-amber-500",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
          Workspace admin
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage members, roles, and invitations for this workspace.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {stat.label}
                </p>
                <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mt-2">
                  {stat.value}
                </p>
              </div>
              <stat.icon
                className={`h-4 w-4 ${stat.accent}`}
                strokeWidth={1.75}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Role Distribution */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Role Distribution
          </h2>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {(
              [
                { role: "ADMIN", color: "bg-amber-500", label: "Admin" },
                { role: "PROJECT_MANAGER", color: "bg-violet-500", label: "PM" },
                { role: "DEVELOPER", color: "bg-blue-500", label: "Developer" },
                { role: "TESTER", color: "bg-emerald-500", label: "Tester" },
              ] as const
            ).map(({ role, color, label }) => {
              const count = stats.roleDistribution[role] ?? 0;
              const pct =
                stats.userCount > 0
                  ? Math.round((count / stats.userCount) * 100)
                  : 0;
              return (
                <div key={role} className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-zinc-600">
                      {label}
                    </span>
                    <span className="text-xs text-zinc-400">{count}</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invite Management */}
      <InviteManagement invitations={invitations} />

      {/* User Management */}
      <UserManagement users={users} currentUserId={session.user.id} />
    </div>
  );
}
