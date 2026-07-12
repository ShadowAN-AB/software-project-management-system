import Link from "next/link";
import { auth } from "@/lib/auth";
import { resolveDefaultWorkspace } from "@/lib/authorization";
import { redirect } from "next/navigation";
import {
  FolderKanban,
  Users,
  BarChart3,
  Zap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    const ctx = await resolveDefaultWorkspace(session.user.id);
    redirect(ctx ? `/w/${ctx.workspaceSlug}/dashboard` : "/onboarding/create-workspace");
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-200/50 bg-white/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center">
                <FolderKanban className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold tracking-tight">PMS</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 shadow-sm transition-all active:scale-[0.98]"
              >
                Get started
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1">
        <div className="relative overflow-hidden">
          {/* Grid background */}
          <div className="absolute inset-0 bg-grid bg-grid-fade opacity-40" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-zinc-200/60 via-zinc-100/30 to-transparent rounded-full blur-3xl" />

          <div className="relative max-w-6xl mx-auto px-6 pt-32 pb-20">
            <div className="max-w-3xl mx-auto text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-medium mb-8">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-pulse" />
                Built for teams that ship
              </div>

              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-zinc-900 leading-[1.1]">
                Manage projects
                <br />
                <span className="text-gradient">like a pro</span>
              </h1>
              <p className="mt-6 text-lg text-zinc-500 max-w-xl mx-auto leading-relaxed">
                Track tasks, manage sprints, and collaborate with your team.
                A clean, fast project management tool built for developers.
              </p>
              <div className="mt-10 flex items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 shadow-lg shadow-zinc-900/20 transition-all active:scale-[0.98]"
                >
                  Start for free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center px-6 py-3 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 shadow-sm transition-all active:scale-[0.98]"
                >
                  Sign in
                </Link>
              </div>

              {/* Social proof */}
              <div className="mt-12 flex items-center justify-center gap-6 text-sm text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Free to start
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  No credit card
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Full RBAC
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="border-t border-zinc-100 bg-zinc-50/50">
          <div className="max-w-6xl mx-auto px-6 py-24">
            <div className="text-center mb-16">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
                Everything you need to ship
              </h2>
              <p className="mt-3 text-sm text-zinc-500 max-w-md mx-auto">
                Powerful features wrapped in a clean interface. No bloat, no noise.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  icon: Users,
                  title: "Team management",
                  desc: "Role-based access with Admin, PM, Developer, and Tester roles. Everyone sees what they need.",
                  accent: "text-blue-500",
                },
                {
                  icon: BarChart3,
                  title: "Sprint planning",
                  desc: "Plan sprints, track progress with Kanban boards, and complete sprints with automatic task rollover.",
                  accent: "text-violet-500",
                },
                {
                  icon: Zap,
                  title: "Live dashboard",
                  desc: "Real-time stats, activity feeds, and progress tracking. Know exactly where your project stands.",
                  accent: "text-amber-500",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="group p-7 bg-white rounded-2xl border border-zinc-200/70 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] hover:shadow-[0_4px_16px_rgb(0_0_0_/_0.06)] hover:border-zinc-300 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <feature.icon className={`h-5 w-5 ${feature.accent} mb-4`} strokeWidth={1.75} />
                  <h3 className="font-semibold text-zinc-900 text-[15px] tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="border-t border-zinc-100">
          <div className="max-w-6xl mx-auto px-6 py-20 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
              Ready to ship faster?
            </h2>
            <p className="mt-3 text-sm text-zinc-500">
              Get your team organized in minutes, not days.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center mt-8 px-6 py-3 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 shadow-lg shadow-zinc-900/20 transition-all active:scale-[0.98]"
            >
              Get started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
