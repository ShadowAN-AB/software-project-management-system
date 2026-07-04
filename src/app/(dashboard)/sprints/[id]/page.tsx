import { getSprint } from "@/services/sprint-actions";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { ArrowLeft, Target } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { SprintActions } from "@/components/features/sprint-actions";

export default async function SprintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, sprint] = await Promise.all([auth(), getSprint(id)]);

  if (!sprint) notFound();

  const doneTasks = sprint.tasks.filter((t) => t.status === "DONE").length;
  const progress =
    sprint.tasks.length > 0
      ? Math.round((doneTasks / sprint.tasks.length) * 100)
      : 0;

  const canManage = ["ADMIN", "PROJECT_MANAGER"].includes(session?.user?.role ?? "");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        href={`/projects/${sprint.project.id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {sprint.project.name}
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{sprint.name}</h1>
            <StatusBadge status={sprint.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {format(new Date(sprint.startDate), "MMM d")} -{" "}
            {format(new Date(sprint.endDate), "MMM d, yyyy")}
          </p>
          {sprint.goal && (
            <div className="flex items-center gap-2 mt-2">
              <Target className="h-4 w-4 text-gray-400" />
              <p className="text-sm text-gray-600">{sprint.goal}</p>
            </div>
          )}
        </div>
        {canManage && (
          <SprintActions sprintId={sprint.id} currentStatus={sprint.status} />
        )}
      </div>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Progress</span>
            <span>
              {doneTasks}/{sprint.tasks.length} tasks &middot; {progress}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">
            Sprint Tasks ({sprint.tasks.length})
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          {sprint.tasks.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-500">
              No tasks in this sprint yet. Add tasks from the project board.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sprint.tasks.map((task) => (
                <li key={task.id} className="px-6 py-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${
                        task.status === "DONE"
                          ? "text-gray-400 line-through"
                          : "text-gray-900"
                      }`}>
                        {task.title}
                      </p>
                      {task.assignee && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {task.assignee.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
