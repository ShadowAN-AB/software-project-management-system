import { getTask } from "@/services/task-actions";
import { auth } from "@/lib/auth";
import { resolveDefaultWorkspace } from "@/lib/authorization";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TaskDetail } from "@/components/features/task-detail";
import { CommentThread } from "@/components/features/comment-thread";
import { getAllUsers } from "@/services/dashboard-actions";
import { getSprintsByProject } from "@/services/sprint-actions";
import { TaskAttachments } from "@/components/features/task-attachments";
import { getAttachments } from "@/services/attachment-actions";
import { TaskLabels } from "@/components/features/task-labels";
import { getTaskLabels, getProjectLabels } from "@/services/label-actions";
import { TaskDependencies } from "@/components/features/task-dependencies";
import { getTaskDependencies } from "@/services/dependency-actions";
import { TaskTimeTracking } from "@/components/features/task-time-tracking";
import { getTimeEntries } from "@/services/time-tracking-actions";
import { TaskChecklist } from "@/components/features/task-checklist";
import { getSubtasks } from "@/services/subtask-actions";
import { getTasksByProject } from "@/services/task-actions";
import { isAIAvailable } from "@/services/ai-actions";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; workspaceSlug: string }>;
}) {
  const { id, workspaceSlug } = await params;
  const [session, task, users] = await Promise.all([
    auth(),
    getTask(id),
    getAllUsers(),
  ]);

  if (!task) notFound();

  const ctx = session?.user ? await resolveDefaultWorkspace(session.user.id) : null;

  const [sprints, attachments, taskLabels, projectLabels, dependencies, timeEntries, subtasks, projectTasks, aiEnabled] =
    await Promise.all([
      getSprintsByProject(task.projectId),
      getAttachments(id),
      getTaskLabels(id),
      getProjectLabels(task.projectId),
      getTaskDependencies(id),
      getTimeEntries(id),
      getSubtasks(id),
      getTasksByProject(task.projectId),
      isAIAvailable(),
    ]);

  const members =
    users.filter((u) =>
      task.project.members?.some((m: { userId: string }) => m.userId === u.id)
    ) || users;

  const simpleTasks = projectTasks.map((t: { id: string; title: string }) => ({ id: t.id, title: t.title }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href={`/w/${workspaceSlug}/projects/${task.projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {task.project.name}
      </Link>

      <TaskDetail
        task={task}
        members={members}
        sprints={sprints}
        currentUserId={session?.user?.id ?? ""}
        currentUserRole={(ctx?.role ?? "DEVELOPER")}
      />

      <TaskChecklist taskId={task.id} subtasks={subtasks} aiEnabled={aiEnabled} />

      <TaskDependencies
        taskId={task.id}
        blockedBy={dependencies.blockedBy}
        blocks={dependencies.blocks}
        projectTasks={simpleTasks}
      />

      <TaskTimeTracking
        taskId={task.id}
        timeEntries={timeEntries}
        currentUserId={session?.user?.id ?? ""}
        currentUserRole={(ctx?.role ?? "DEVELOPER")}
      />

      <TaskLabels
        taskId={task.id}
        projectId={task.projectId}
        taskLabels={taskLabels}
        projectLabels={projectLabels}
      />

      <TaskAttachments
        taskId={task.id}
        attachments={attachments}
        currentUserId={session?.user?.id ?? ""}
        currentUserRole={(ctx?.role ?? "DEVELOPER")}
      />

      <CommentThread
        taskId={task.id}
        comments={task.comments}
        currentUserName={session?.user?.name ?? ""}
        currentUserId={session?.user?.id ?? ""}
      />
    </div>
  );
}
