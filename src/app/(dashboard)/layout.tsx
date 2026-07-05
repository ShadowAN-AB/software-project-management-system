import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/features/sidebar";
import { NotificationBell } from "@/components/features/notification-bell";
import { SearchCommand } from "@/components/features/search-command";
import { getNotifications, getUnreadCount } from "@/services/notification-actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(),
    getUnreadCount(),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userName={session.user.name} userRole={session.user.role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-8 border-b border-zinc-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm flex-shrink-0">
          <SearchCommand />
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            userId={session.user.id}
          />
        </header>
        <main className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/50 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
