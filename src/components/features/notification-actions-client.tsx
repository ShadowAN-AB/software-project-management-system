"use client";

import { useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { markAllAsRead } from "@/services/notification-actions";
import { Button } from "@/components/ui/button";
import { CheckCheck } from "lucide-react";

export function NotificationActions({ workspaceId }: { workspaceId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  // workspaceId comes from server params; also fall back to route params just
  // in case a caller renders this without the prop.
  const params = useParams();
  const fallbackSlug = params.workspaceSlug as string | undefined;

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={isPending}
      onClick={() => {
        startTransition(async () => {
          // Prefer the passed-in workspaceId (resolved server-side against ctx);
          // the fallback slug is only used if someone renders this in isolation.
          await markAllAsRead(workspaceId ?? fallbackSlug);
          router.refresh();
        });
      }}
    >
      <CheckCheck className="h-3.5 w-3.5" />
      Mark all read
    </Button>
  );
}
