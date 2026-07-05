"use client";

import { useTransition } from "react";
import { markAllAsRead } from "@/services/notification-actions";
import { Button } from "@/components/ui/button";
import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export function NotificationActions() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={isPending}
      onClick={() => {
        startTransition(async () => {
          await markAllAsRead();
          router.refresh();
        });
      }}
    >
      <CheckCheck className="h-3.5 w-3.5" />
      Mark all read
    </Button>
  );
}
