// Placeholder — M4 wires up cross-workspace invitations that a user
// can accept from here. Kept as a stub so sidebar/nav links resolve.
export default function InvitationsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Pending invitations
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Cross-workspace invite acceptance ships in a follow-up milestone.
        </p>
      </div>
    </div>
  );
}
