import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Timer } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default async function SprintsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const isAdmin = session.user.role === "ADMIN";

  const sprints = await prisma.sprint.findMany({
    where: isAdmin
      ? {}
      : { project: { members: { some: { userId: session.user.id } } } },
    include: {
      project: true,
      _count: { select: { tasks: true } },
      tasks: { where: { status: "DONE" }, select: { id: true } },
    },
    orderBy: { startDate: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sprints</h1>
        <p className="text-sm text-gray-500 mt-1">
          {sprints.length} sprint{sprints.length !== 1 ? "s" : ""} across your projects
        </p>
      </div>

      {sprints.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Timer className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-sm">No sprints created yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sprints.map((sprint) => {
            const progress =
              sprint._count.tasks > 0
                ? Math.round((sprint.tasks.length / sprint._count.tasks) * 100)
                : 0;
            return (
              <Link key={sprint.id} href={`/sprints/${sprint.id}`}>
                <Card className="hover:border-blue-200 hover:shadow-md transition-all cursor-pointer mb-4">
                  <CardContent>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {sprint.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {sprint.project.name} &middot;{" "}
                          {format(new Date(sprint.startDate), "MMM d")} -{" "}
                          {format(new Date(sprint.endDate), "MMM d, yyyy")}
                        </p>
                      </div>
                      <StatusBadge status={sprint.status} />
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>
                          {sprint.tasks.length}/{sprint._count.tasks} tasks done
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
