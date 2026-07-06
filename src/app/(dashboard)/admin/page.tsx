import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAdminStats, getAdminUsers } from "@/services/admin-actions";
import { getInvitations } from "@/services/invite-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Users, FolderKanban, ListTodo, ShieldCheck } from "lucide-react";
import { UserManagement } from "@/components/features/user-management";
import { InviteManagement } from "@/components/features/invite-management";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [stats, users, invitations] = await Promise.all([
    getAdminStats(),
    getAdminUsers(),
    getInvitations(),
  ]);

  const statCards = [
    {
      label: "Total Users",
      value: stats.userCount,
      icon: Users,
      gradient: "from-blue-500 to-indigo-600",
    },
    {
      label: "Projects",
      value: stats.projectCount,
      icon: FolderKanban,
      gradient: "from-emerald-500 to-teal-600",
    },
    {
      label: "Total Tasks",
      value: stats.taskCount,
      icon: ListTodo,
      gradient: "from-violet-500 to-purple-600",
    },
    {
      label: "Admins",
      value: stats.roleDistribution.ADMIN ?? 0,
      icon: ShieldCheck,
      gradient: "from-amber-500 to-orange-600",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
          Admin Panel
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage users, roles, and system settings
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent>
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}
                >
                  <stat.icon className="h-5 w-5 text-white" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-900">
                    {stat.value}
                  </p>
                  <p className="text-xs text-zinc-500">{stat.label}</p>
                </div>
              </div>
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
