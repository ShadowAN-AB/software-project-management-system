import { getProject, getAllUsers } from "@/services/project-actions";
import { getProjectOverview } from "@/services/overview-actions";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/badge";
import { Timer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { KanbanBoard } from "@/components/features/kanban-board";
import { CreateTaskForm } from "@/components/features/create-task-form";
import { ProjectOverview } from "@/components/features/project-overview";
import { TeamManagement } from "@/components/features/team-management";
import { ExportCsvButton } from "@/components/features/export-csv-button";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, project, overview, allUsers] = await Promise.all([
    auth(),
    getProject(id),
    getProjectOverview(id),
    getAllUsers(),
  ]);

  if (!project) notFound();

  const canManage = ["ADMIN", "PROJECT_MANAGER"].includes(session?.user?.role ?? "");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1 font-mono">{project.key}</p>
          {project.description && (
            <p className="text-sm text-gray-600 mt-2 max-w-2xl">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton projectId={project.id} label="Export Tasks" />
          {canManage && (
            <Link
              href={`/sprints/new?projectId=${project.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Timer className="h-4 w-4" />
              New Sprint
            </Link>
          )}
        </div>
      </div>

      {/* Project Overview */}
      {overview && <ProjectOverview data={overview} />}

      {/* Create Task */}
      <CreateTaskForm
        projectId={project.id}
        members={project.members.map((m) => m.user)}
        sprints={project.sprints}
      />

      {/* Kanban Board */}
      <KanbanBoard
        tasks={project.tasks}
        projectId={project.id}
        currentUserId={session?.user?.id ?? ""}
      />

      {/* Team Members */}
      <TeamManagement
        projectId={project.id}
        members={project.members}
        allUsers={allUsers}
        canManage={canManage}
        currentUserId={session?.user?.id ?? ""}
      />
    </div>
  );
}
