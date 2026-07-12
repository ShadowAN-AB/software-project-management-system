import { getReportsData } from "@/services/reports-actions";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, AlertTriangle, TrendingUp, Users, Download } from "lucide-react";
import { ReportsCharts } from "@/components/features/reports-charts";

export default async function ReportsPage() {
  const data = await getReportsData();
  if (!data) redirect("/login");

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Project health, velocity, and team performance
          </p>
        </div>
        <a
          href="/api/export/reports"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-[0_1px_2px_rgb(0_0_0_/_0.08)] transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </a>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Completed", value: data.tasksByStatus.DONE ?? 0, icon: TrendingUp },
          { label: "In Progress", value: data.tasksByStatus.IN_PROGRESS ?? 0, icon: BarChart3 },
          { label: "Overdue", value: data.overdueTasks, icon: AlertTriangle },
          { label: "Active Members", value: data.topAssignees.length, icon: Users },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {card.label}
                </p>
                <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mt-2">
                  {card.value}
                </p>
              </div>
              <card.icon
                className="h-4 w-4 text-zinc-400 dark:text-zinc-500"
                strokeWidth={1.75}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <ReportsCharts data={data} />
    </div>
  );
}
