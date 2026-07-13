"use client";

import { Suspense, useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { register } from "@/services/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderKanban } from "lucide-react";
import type { ActionResult } from "@/types";

type InviteInfo = {
  email: string;
  role: string;
  token: string;
  workspace: { id: string; name: string; slug: string };
  invitedBy: { name: string };
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <div className="h-8 w-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    register,
    null
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/invite/validate?token=${encodeURIComponent(token)}`);
      if (cancelled) return;
      if (!res.ok) {
        setInviteError("This invitation link is invalid or expired.");
        return;
      }
      const data = (await res.json()) as InviteInfo;
      setInvite(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const showingInvite = Boolean(token);

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/40 via-zinc-900/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-zinc-950 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center mb-8">
            <FolderKanban className="h-5 w-5 text-zinc-950" strokeWidth={2} />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">
            Your team&apos;s
            <br />
            command center.
          </h2>
          <p className="mt-4 text-zinc-400 text-sm leading-relaxed max-w-sm">
            Kanban boards, sprint planning, role-based access — everything you
            need to move fast without losing control.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-zinc-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center">
              <FolderKanban className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">PMS</span>
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            {showingInvite ? "Accept your invitation" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            {invite ? (
              <>
                Joining <span className="font-semibold text-zinc-900">{invite.workspace.name}</span>{" "}
                as {roleLabel(invite.role)}. Invited by {invite.invitedBy.name}.
              </>
            ) : showingInvite && !inviteError ? (
              <>Loading invitation…</>
            ) : (
              <>We&apos;ll set up a workspace for you as the admin.</>
            )}
          </p>

          {inviteError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200/80 rounded-lg text-sm text-red-600">
              {inviteError}
            </div>
          )}

          <form action={action} className="mt-6 space-y-5">
            {state && !state.success && (
              <div className="p-3 bg-red-50 border border-red-200/80 rounded-lg text-sm text-red-600">
                {state.error}
              </div>
            )}
            {token && <input type="hidden" name="token" value={token} />}

            <Input id="name" name="name" label="Full name" placeholder="John Doe" required />
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              defaultValue={invite?.email ?? ""}
              readOnly={Boolean(invite)}
              required
            />
            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              minLength={6}
              required
            />

            <Button
              type="submit"
              loading={pending}
              disabled={showingInvite && !invite}
              className="w-full"
            >
              {pending
                ? "Creating account…"
                : showingInvite
                ? "Accept invitation"
                : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              href={token ? `/login?token=${encodeURIComponent(token)}` : "/login"}
              className="font-medium text-zinc-900 hover:text-blue-600 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: string): string {
  return role.replace(/_/g, " ").toLowerCase();
}
