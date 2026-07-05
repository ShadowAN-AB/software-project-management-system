import { getActivityFeed } from "@/services/activity-actions";
import { getProjects } from "@/services/project-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { ActivityTimeline } from "@/components/features/activity-timeline";

export default async function ActivityPage() {
  const [activities, projects] = await Promise.all([
    getActivityFeed({ limit: 50 }),
    getProjects(),
  ]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
          Activity
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Recent activity across your projects
        </p>
      </div>

      {activities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Activity className="h-12 w-12 text-zinc-200 mb-4" strokeWidth={1.5} />
            <p className="text-sm font-medium text-zinc-900">No activity yet</p>
            <p className="text-xs text-zinc-400 mt-1">
              Activity will appear here as your team works
            </p>
          </CardContent>
        </Card>
      ) : (
        <ActivityTimeline
          activities={activities}
          projects={projects.map((p) => ({
            id: p.id,
            name: p.name,
          }))}
        />
      )}
    </div>
  );
}
