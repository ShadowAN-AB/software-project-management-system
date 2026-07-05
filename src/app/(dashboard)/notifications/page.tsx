import { getNotifications } from "@/services/notification-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { NotificationActions } from "@/components/features/notification-actions-client";

const TYPE_COLORS: Record<string, string> = {
  TASK_ASSIGNED: "bg-blue-500",
  TASK_STATUS_CHANGED: "bg-amber-500",
  COMMENT_ADDED: "bg-violet-500",
  PROJECT_ADDED: "bg-emerald-500",
  SPRINT_STARTED: "bg-cyan-500",
  MENTIONED: "bg-rose-500",
};

export default async function NotificationsPage() {
  const notifications = await getNotifications();
  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {unread.length} unread notification{unread.length !== 1 ? "s" : ""}
          </p>
        </div>
        {unread.length > 0 && <NotificationActions />}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Bell className="h-12 w-12 text-zinc-200 mb-4" strokeWidth={1.5} />
            <p className="text-sm font-medium text-zinc-900">
              No notifications
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              You&apos;re all caught up
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {unread.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
                  Unread ({unread.length})
                </h2>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-zinc-50">
                  {unread.map((n) => (
                    <li
                      key={n.id}
                      className="flex items-start gap-3 px-6 py-4 bg-blue-50/20 hover:bg-blue-50/40 transition-colors"
                    >
                      <div
                        className={`h-2.5 w-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                          TYPE_COLORS[n.type] ?? "bg-zinc-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        {n.link ? (
                          <Link
                            href={n.link}
                            className="text-sm text-zinc-900 hover:text-blue-600 transition-colors"
                          >
                            {n.message}
                          </Link>
                        ) : (
                          <p className="text-sm text-zinc-900">{n.message}</p>
                        )}
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {read.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
                  Earlier ({read.length})
                </h2>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-zinc-50">
                  {read.map((n) => (
                    <li
                      key={n.id}
                      className="flex items-start gap-3 px-6 py-4 hover:bg-zinc-50 transition-colors"
                    >
                      <div
                        className={`h-2.5 w-2.5 rounded-full mt-1.5 flex-shrink-0 opacity-40 ${
                          TYPE_COLORS[n.type] ?? "bg-zinc-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        {n.link ? (
                          <Link
                            href={n.link}
                            className="text-sm text-zinc-500 hover:text-blue-600 transition-colors"
                          >
                            {n.message}
                          </Link>
                        ) : (
                          <p className="text-sm text-zinc-500">{n.message}</p>
                        )}
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
