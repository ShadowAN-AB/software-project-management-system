"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { bootstrapAdmin } from "@/services/admin-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight } from "lucide-react";

export default function SetupPage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  function handlePromote() {
    setError(null);
    startTransition(async () => {
      const result = await bootstrapAdmin();
      if (result.success) {
        setSuccess(true);
        // Force session refresh by redirecting — JWT will be refreshed on next auth() call
        setTimeout(() => {
          window.location.href = "/admin";
        }, 1500);
      } else {
        setError(result.error ?? "Failed to promote");
      }
    });
  }

  return (
    <div className="max-w-lg mx-auto mt-20">
      <Card>
        <CardContent className="flex flex-col items-center text-center py-12 px-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-5">
            <ShieldCheck className="h-7 w-7 text-white" strokeWidth={1.75} />
          </div>

          {success ? (
            <>
              <h1 className="text-xl font-bold text-zinc-900 mb-2">
                You are now Admin
              </h1>
              <p className="text-sm text-zinc-500 mb-6">
                Redirecting to admin panel...
              </p>
              <div className="h-1.5 w-32 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full animate-pulse w-full" />
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-zinc-900 mb-2">
                System Setup
              </h1>
              <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
                No admin user exists in the system. Promote your account to Admin
                to unlock project creation, user management, and all system features.
              </p>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 px-4 py-2.5 rounded-lg mb-5 w-full">
                  {error}
                </p>
              )}

              <Button
                onClick={handlePromote}
                loading={isPending}
                className="gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                Promote me to Admin
                <ArrowRight className="h-4 w-4" />
              </Button>

              <p className="text-xs text-zinc-400 mt-5">
                This only works when no admin exists in the system.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
