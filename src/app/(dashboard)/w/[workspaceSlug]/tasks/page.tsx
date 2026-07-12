import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAIAvailable } from "@/services/ai-actions";
import { MyTasksView } from "@/components/features/my-tasks-view";

export default async function MyTasksPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [tasks, aiEnabled] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: session.user.id },
      include: {
        project: { select: { id: true, name: true, key: true } },
        sprint: { select: { name: true } },
      },
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { updatedAt: "desc" },
      ],
    }),
    isAIAvailable(),
  ]);

  return (
    <div className="max-w-5xl mx-auto">
      <MyTasksView tasks={tasks} aiEnabled={aiEnabled} />
    </div>
  );
}
