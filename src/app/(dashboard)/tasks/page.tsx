import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { ListTodo } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default async function MyTasksPage() {
  const session = await auth();
  if (!session?.user) return null;

  const tasks = await prisma.task.findMany({
    where: { assigneeId: session.user.id },
    include: {
      project: true,
      sprint: true,
    },
    orderBy: [
      { status: "asc" },
      { priority: "desc" },
      { updatedAt: "desc" },
    ],
  });

  const grouped = {
    active: tasks.filter((t) => !["DONE", "BACKLOG"].includes(t.status)),
    backlog: tasks.filter((t) => t.status === "BACKLOG"),
    done: tasks.filter((t) => t.status === "DONE"),
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""} assigned to you
        </p>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ListTodo className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-sm">No tasks assigned to you yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {grouped.active.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">
                  Active ({grouped.active.length})
                </h2>
              </CardHeader>
              <CardContent className="p-0">
                <TaskList tasks={grouped.active} />
              </CardContent>
            </Card>
          )}

          {grouped.backlog.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">
                  Backlog ({grouped.backlog.length})
                </h2>
              </CardHeader>
              <CardContent className="p-0">
                <TaskList tasks={grouped.backlog} />
              </CardContent>
            </Card>
          )}

          {grouped.done.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">
                  Done ({grouped.done.length})
                </h2>
              </CardHeader>
              <CardContent className="p-0">
                <TaskList tasks={grouped.done} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function TaskList({
  tasks,
}: {
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    type: string;
    updatedAt: Date;
    project: { id: string; name: string; key: string };
    sprint: { name: string } | null;
  }[];
}) {
  return (
    <ul className="divide-y divide-gray-100">
      {tasks.map((task) => (
        <li key={task.id} className="px-6 py-3 hover:bg-gray-50">
          <Link href={`/projects/${task.project.id}`}>
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{task.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400 font-mono">
                    {task.project.key}
                  </span>
                  <span className="text-xs text-gray-400">{task.project.name}</span>
                  {task.sprint && (
                    <span className="text-xs text-blue-500">
                      {task.sprint.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatDistanceToNow(new Date(task.updatedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
