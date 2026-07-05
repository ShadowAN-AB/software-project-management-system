import { auth } from "@/lib/auth";
import { getTeamWorkload } from "@/services/overview-actions";
import { TeamWorkload } from "@/components/features/team-workload";
import { redirect } from "next/navigation";

export default async function WorkloadPage() {
  const session = await auth();
  if (!session?.user) return null;

  if (!["ADMIN", "PROJECT_MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const members = await getTeamWorkload();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Workload</h1>
        <p className="text-sm text-gray-500 mt-1">
          Capacity planning and task distribution across the team
        </p>
      </div>

      <TeamWorkload members={members} />
    </div>
  );
}
