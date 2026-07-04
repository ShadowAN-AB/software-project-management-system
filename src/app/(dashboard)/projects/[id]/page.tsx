import { getProject } from "@/services/project-actions";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Users, ListTodo, Timer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { KanbanBoard } from "@/components/features/kanban-board";
import { CreateTaskForm } from "@/components/features/create-task-form";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, project] = await Promise.all([auth(), getProject(id)]);

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

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3">
            <Users className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Members</p>
              <p className="text-lg font-semibold">{project.members.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <ListTodo className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Tasks</p>
              <p className="text-lg font-semibold">{project._count.tasks}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <Timer className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Sprints</p>
              <p className="text-lg font-semibold">{project.sprints.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
      />

      {/* Team Members */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-gray-100">
            {project.members.map((member) => (
              <li key={member.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {member.user.name}
                  </p>
                  <p className="text-xs text-gray-500">{member.user.email}</p>
                </div>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  {member.role.replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
