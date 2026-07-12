"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/features/sidebar";
import { NotificationBell } from "@/components/features/notification-bell";
import { SearchCommand } from "@/components/features/search-command";
import { Menu, X } from "lucide-react";
import type { NotificationType } from "@prisma/client";

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: Date;
};

export function DashboardShell({
  children,
  userName,
  userRole,
  userId,
  workspaceSlug,
  workspaces,
  notifications,
  unreadCount,
}: {
  children: React.ReactNode;
  userName: string;
  userRole: string;
  userId: string;
  workspaceSlug: string;
  workspaces: { id: string; slug: string; name: string; role: string }[];
  notifications: Notification[];
  unreadCount: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar userName={userName} userRole={userRole} workspaceSlug={workspaceSlug} workspaces={workspaces} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-[280px] max-w-[85vw]">
            <Sidebar
              userName={userName}
              userRole={userRole}
              workspaceSlug={workspaceSlug}
              workspaces={workspaces}
              onNavigate={() => setMobileOpen(false)}
            />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-[-44px] p-2 rounded-full bg-zinc-800 text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 md:px-8 border-b border-zinc-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <SearchCommand />
          </div>
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            userId={userId}
          />
        </header>
        <main className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/50 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
