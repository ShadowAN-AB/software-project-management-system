"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[dashboard error]", error);
    }
  }, [error]);

  return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <div className="h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mx-auto mb-5">
        <AlertTriangle
          className="h-7 w-7 text-zinc-700 dark:text-zinc-300"
          strokeWidth={1.75}
        />
      </div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        We hit an unexpected error loading this page. You can try again.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500 font-mono">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-6">
        <Button onClick={() => reset()}>
          <RotateCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      </div>
    </div>
  );
}
