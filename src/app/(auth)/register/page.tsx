"use client";

import { useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { register } from "@/services/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderKanban, Mail, ShieldCheck } from "lucide-react";
import type { ActionResult } from "@/types";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  DEVELOPER: "Developer",
  TESTER: "Tester",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "text-amber-700 bg-amber-50 border-amber-200",
  PROJECT_MANAGER: "text-violet-700 bg-violet-50 border-violet-200",
  DEVELOPER: "text-blue-700 bg-blue-50 border-blue-200",
  TESTER: "text-emerald-700 bg-emerald-50 border-emerald-200",
};

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [invite, setInvite] = useState<{
    email: string;
    role: string;
    token: string;
  } | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [invalidToken, setInvalidToken] = useState(false);

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    register,
    null
  );

  // Validate invite token on mount
  useEffect(() => {
    if (!token) return;
    async function validate() {
      try {
        const res = await fetch(`/api/invite/validate?token=${token}`);
        if (res.ok) {
          const data = await res.json();
          setInvite(data);
        } else {
          setInvalidToken(true);
        }
      } catch {
        setInvalidToken(true);
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (token && invalidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-6">
        <div className="text-center max-w-sm">
          <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Mail className="h-6 w-6 text-red-500" strokeWidth={1.75} />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 mb-2">
            Invalid Invitation
          </h1>
          <p className="text-sm text-zinc-500 leading-relaxed mb-6">
            This invitation link is invalid, has expired, or has already been
            used. Contact your admin for a new invite.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-all"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — gradient */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-blue-600/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-zinc-950 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mb-8">
            <FolderKanban className="h-5 w-5 text-white" strokeWidth={2} />
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
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <FolderKanban className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">PMS</span>
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            {invite ? "You're invited" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            {invite
              ? "Complete your registration to join the team"
              : "First user becomes the system admin"}
          </p>

          {/* Invite badge */}
          {invite && (
            <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-100 border border-zinc-200">
              <ShieldCheck
                className="h-5 w-5 text-zinc-400 flex-shrink-0"
                strokeWidth={1.75}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-500">Invited as</p>
                <span
                  className={`inline-flex items-center mt-0.5 px-2 py-0.5 text-xs font-medium rounded border ${
                    ROLE_COLORS[invite.role] ?? ROLE_COLORS.DEVELOPER
                  }`}
                >
                  {ROLE_LABELS[invite.role] ?? invite.role}
                </span>
              </div>
            </div>
          )}

          <form action={action} className="mt-6 space-y-5">
            {/* Hidden token field */}
            {invite && (
              <input type="hidden" name="token" value={invite.token} />
            )}

            {state && !state.success && (
              <div className="p-3 bg-red-50 border border-red-200/80 rounded-lg text-sm text-red-600 flex items-center gap-2">
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {state.error}
              </div>
            )}

            <Input
              id="name"
              name="name"
              label="Full name"
              placeholder="John Doe"
              required
            />

            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              defaultValue={invite?.email ?? ""}
              readOnly={!!invite}
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

            <Button type="submit" loading={pending} className="w-full">
              {invite ? "Join team" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/login"
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
