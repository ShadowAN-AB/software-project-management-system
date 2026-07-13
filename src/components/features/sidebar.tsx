"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Timer,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Settings,
  BarChart3,
  Activity,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";
import { WorkspaceSwitcher } from "./workspace-switcher";

const baseNavItems: { path: string; label: string; icon: typeof LayoutDashboard }[] = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/projects", label: "Projects", icon: FolderKanban },
  { path: "/tasks", label: "My Tasks", icon: ListTodo },
  { path: "/sprints", label: "Sprints", icon: Timer },
];

function Avatar({ name, collapsed }: { name: string; collapsed: boolean }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 font-semibold ${
        collapsed ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm"
      }`}
    >
      {initials}
    </div>
  );
}

export function Sidebar({
  userName,
  userRole,
  workspaceSlug,
  workspaces,
  pendingInvitationsCount = 0,
  onNavigate,
}: {
  userName: string;
  userRole: string;
  workspaceSlug: string;
  workspaces: { id: string; slug: string; name: string; role: string }[];
  pendingInvitationsCount?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const prefix = `/w/${workspaceSlug}`;

  const navItems = [
    ...baseNavItems,
    { path: "/activity", label: "Activity", icon: Activity },
    { path: "/reports", label: "Reports", icon: BarChart3 },
    ...(["ADMIN", "PROJECT_MANAGER"].includes(userRole)
      ? [{ path: "/workload", label: "Workload", icon: UsersRound }]
      : []),
    { path: "/settings", label: "Settings", icon: Settings },
    ...(userRole === "ADMIN" ? [{ path: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ].map((item) => ({ ...item, href: `${prefix}${item.path}` }));

  return (
    <aside
      className={`flex flex-col bg-zinc-950 transition-all duration-300 ease-in-out ${
        collapsed ? "w-[68px]" : "w-[260px]"
      }`}
    >
      {/* Logo + workspace switcher */}
      <div className="flex flex-col gap-2 px-3 pt-3 pb-1">
        {!collapsed ? (
          <Link href={`${prefix}/dashboard`} className="flex items-center gap-2.5 px-2 py-1">
            <div className="h-7 w-7 rounded-md bg-white flex items-center justify-center">
              <FolderKanban className="h-4 w-4 text-zinc-950" strokeWidth={2} />
            </div>
            <span className="text-[13px] font-bold text-white tracking-tight">PMS</span>
          </Link>
        ) : (
          <div className="h-7 w-7 rounded-md bg-white flex items-center justify-center mx-auto">
            <FolderKanban className="h-4 w-4 text-zinc-950" strokeWidth={2} />
          </div>
        )}
        <WorkspaceSwitcher
          workspaces={workspaces}
          pendingInvitationsCount={pendingInvitationsCount}
          collapsed={collapsed}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 mt-2 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              } ${collapsed ? "justify-center" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${
                  isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                }`}
                strokeWidth={1.75}
              />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-3 mb-1">
        <ThemeToggle collapsed={collapsed} />
      </div>

      {/* Collapse toggle */}
      <div className="px-3 mb-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* User section */}
      <div className="px-3 py-3 border-t border-zinc-800">
        <div
          className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}
        >
          <Avatar name={userName} collapsed={collapsed} />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">
                {userName}
              </p>
              <p className="text-xs text-zinc-500">
                {userRole.replace("_", " ")}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Sign out"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
