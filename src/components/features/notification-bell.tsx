"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { markAsRead, markAllAsRead } from "@/services/notification-actions";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEventStream } from "@/hooks/use-event-stream";
import type { SSEFrame } from "@/lib/sse-events";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: Date;
};

const TYPE_COLORS: Record<string, string> = {
  TASK_ASSIGNED: "bg-blue-500",
  TASK_STATUS_CHANGED: "bg-amber-500",
  COMMENT_ADDED: "bg-violet-500",
  PROJECT_ADDED: "bg-emerald-500",
  SPRINT_STARTED: "bg-cyan-500",
  MENTIONED: "bg-rose-500",
};

export function NotificationBell({
  notifications: initialNotifications,
  unreadCount: initialUnreadCount,
  userId,
}: {
  notifications: Notification[];
  unreadCount: number;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [localNotifications, setLocalNotifications] = useState(initialNotifications);
  const [localUnreadCount, setLocalUnreadCount] = useState(initialUnreadCount);

  useEventStream({
    channels: [],
    currentUserId: userId,
    skipOwnEvents: false,
    handlers: {
      "notification:created": (event: SSEFrame) => {
        if (event.type !== "notification:created") return;
        const n = event.notification;
        setLocalNotifications((prev) => {
          if (prev.some((existing) => existing.id === n.id)) return prev;
          return [{ ...n, createdAt: new Date(n.createdAt) }, ...prev];
        });
        setLocalUnreadCount((prev) => prev + 1);
      },
    },
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleMarkRead(id: string) {
    setLocalNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setLocalUnreadCount((prev) => Math.max(0, prev - 1));
    startTransition(async () => {
      await markAsRead(id);
    });
  }

  function handleMarkAllRead() {
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setLocalUnreadCount(0);
    startTransition(async () => {
      await markAllAsRead();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {localUnreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
            {localUnreadCount > 99 ? "99+" : localUnreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Notifications
            </h3>
            {localUnreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {localNotifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="h-8 w-8 text-zinc-200 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-sm text-zinc-400">No notifications</p>
              </div>
            ) : (
              localNotifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors border-b border-zinc-50 dark:border-zinc-700/50 last:border-0 ${
                    !n.read ? "bg-blue-50/30 dark:bg-blue-500/10" : ""
                  }`}
                >
                  <div
                    className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${
                      TYPE_COLORS[n.type] ?? "bg-zinc-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => {
                          setOpen(false);
                          if (!n.read) handleMarkRead(n.id);
                        }}
                        className="text-sm text-zinc-900 dark:text-zinc-100 hover:text-blue-600 transition-colors line-clamp-2"
                      >
                        {n.message}
                      </Link>
                    ) : (
                      <p className="text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2">
                        {n.message}
                      </p>
                    )}
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="p-1 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0"
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {localNotifications.length > 0 && (
            <div className="border-t border-zinc-100 dark:border-zinc-700 px-4 py-2.5">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
