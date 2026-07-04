"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/services/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderKanban } from "lucide-react";
import type { ActionResult } from "@/types";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    register,
    null
  );

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
            Kanban boards, sprint planning, role-based access — everything
            you need to move fast without losing control.
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
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Get started with your team in seconds
          </p>

          <form action={action} className="mt-8 space-y-5">
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
              Create account
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
