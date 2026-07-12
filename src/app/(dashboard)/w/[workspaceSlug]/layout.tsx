import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/features/dashboard-shell";
import { getNotifications, getUnreadCount } from "@/services/notification-actions";
import { requireWorkspaceMember } from "@/lib/authorization";
import { listMyWorkspaces } from "@/services/workspace-actions";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { workspaceSlug } = await params;
  // Calls notFound() on miss — will render (dashboard)/not-found.tsx.
  // `lastWorkspaceSlug` cookie sync happens in middleware.ts (server layouts
  // are not allowed to mutate cookies in Next 16).
  const ctx = await requireWorkspaceMember(workspaceSlug, session.user.id);

  const [notifications, unreadCount, workspaces] = await Promise.all([
    getNotifications(),
    getUnreadCount(),
    listMyWorkspaces(),
  ]);

  return (
    <DashboardShell
      userName={session.user.name}
      userRole={ctx.role}
      userId={session.user.id}
      workspaceSlug={ctx.workspaceSlug}
      workspaces={workspaces}
      notifications={notifications}
      unreadCount={unreadCount}
    >
      {children}
    </DashboardShell>
  );
}
