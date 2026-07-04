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
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "My Tasks", icon: ListTodo },
  { href: "/sprints", label: "Sprints", icon: Timer },
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
      className={`flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-white font-semibold ${
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
}: {
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col bg-zinc-950 transition-all duration-300 ease-in-out ${
        collapsed ? "w-[68px]" : "w-[260px]"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <FolderKanban className="h-4.5 w-4.5 text-white" strokeWidth={2} />
            </div>
            <span className="text-[15px] font-bold text-white tracking-tight">
              PMS
            </span>
          </Link>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mx-auto">
            <FolderKanban className="h-4.5 w-4.5 text-white" strokeWidth={2} />
          </div>
        )}
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
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </form>
          )}
        </div>
      </div>
    </aside>
  );
}
