import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <div className="h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mx-auto mb-5">
        <Compass
          className="h-7 w-7 text-zinc-700 dark:text-zinc-300"
          strokeWidth={1.75}
        />
      </div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        The page you&apos;re looking for doesn&apos;t exist or was moved.
      </p>
      <div className="mt-6">
        <Link href="/">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
