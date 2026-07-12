import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CreateWorkspaceForm } from "./create-workspace-form";

// Reachable when a logged-in user has zero memberships (after being removed from
// their last one) or explicitly navigates here from the switcher's "Create workspace"
// entry. If they already have memberships and hit this page from the "removed"
// case, we resolve their next-best workspace and redirect them there instead.
export default async function CreateWorkspacePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Note: users who already belong to workspaces can still land here on purpose
  // via the switcher's "Create workspace" entry. Only bounce them if they got here
  // by mistake (e.g. hit `/onboarding/create-workspace` directly with no intent).
  // For M3 we render the form unconditionally; the switcher is the only entry point.

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Create a workspace
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          A workspace holds your team&apos;s projects, sprints, and tasks. You&apos;ll be its admin.
        </p>
        <div className="mt-6">
          <CreateWorkspaceForm />
        </div>
      </div>
    </div>
  );
}
