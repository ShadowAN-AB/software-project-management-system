import { getReportsData } from "@/services/reports-actions";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarChart3, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { ReportsCharts } from "@/components/features/reports-charts";

export default async function ReportsPage() {
  const data = await getReportsData();
  if (!data) redirect("/login");

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
          Reports & Analytics
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Project health, velocity, and team performance
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900">
                  {data.tasksByStatus.DONE ?? 0}
                </p>
                <p className="text-xs text-zinc-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900">
                  {data.tasksByStatus.IN_PROGRESS ?? 0}
                </p>
                <p className="text-xs text-zinc-500">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-white" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900">
                  {data.overdueTasks}
                </p>
                <p className="text-xs text-zinc-500">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Users className="h-5 w-5 text-white" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900">
                  {data.topAssignees.length}
                </p>
                <p className="text-xs text-zinc-500">Active Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ReportsCharts data={data} />
    </div>
  );
}
