import { getProjects } from "@/services/project-actions";
import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { FolderKanban, Plus, Users, ListTodo } from "lucide-react";
import Link from "next/link";

export default async function ProjectsPage() {
  const [session, projects] = await Promise.all([auth(), getProjects()]);
  const canCreate = ["ADMIN", "PROJECT_MANAGER"].includes(
    session?.user?.role ?? ""
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            Projects
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-12 w-12 rounded-xl bg-zinc-100 flex items-center justify-center mb-4">
              <FolderKanban className="h-6 w-6 text-zinc-400" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-medium text-zinc-900">No projects yet</p>
            <p className="text-xs text-zinc-400 mt-1">
              Create your first project to get started
            </p>
            {canCreate && (
              <Link
                href="/projects/new"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-all active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                New Project
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card hoverable className="cursor-pointer h-full">
                <CardContent>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-zinc-900 text-[15px]">
                        {project.name}
                      </h3>
                      <span className="text-xs text-zinc-400 font-mono">
                        {project.key}
                      </span>
                    </div>
                    <StatusBadge status={project.status} />
                  </div>
                  {project.description && (
                    <p className="text-sm text-zinc-500 line-clamp-2 mb-4 leading-relaxed">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-zinc-400 pt-3 border-t border-zinc-100">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {project.members.length} member
                      {project.members.length !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ListTodo className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {project._count.tasks} task
                      {project._count.tasks !== 1 ? "s" : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
