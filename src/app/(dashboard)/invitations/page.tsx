import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMyPendingInvitations, acceptInvitation, declineInvitation } from "@/services/invite-actions";
import { Building2, Check, X, Mail } from "lucide-react";

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ mismatch?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { mismatch } = await searchParams;
  const invitations = await getMyPendingInvitations();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-2 mt-3">
            <Mail className="h-5 w-5 text-zinc-400" strokeWidth={1.75} />
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Pending invitations
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Workspaces that have invited{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {session.user.email}
            </span>{" "}
            to join.
          </p>
        </div>

        {mismatch && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/40 p-4 text-sm text-amber-800 dark:text-amber-200">
            That invitation link was sent to a different email address. Sign in
            with the invited address, or ask the admin to send a new invite.
          </div>
        )}

        {invitations.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No pending invitations. You&apos;re all caught up.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {inv.workspace.name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {inv.invitedBy.name} invited you as{" "}
                        <span className="font-medium">
                          {inv.role.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </p>
                      <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Expires {inv.expiresAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <form
                      action={async () => {
                        "use server";
                        await declineInvitation(inv.token);
                      }}
                    >
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                        Decline
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await acceptInvitation(inv.token);
                      }}
                    >
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2} />
                        Accept
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
