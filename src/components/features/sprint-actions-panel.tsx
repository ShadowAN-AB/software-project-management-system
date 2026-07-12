"use client";

import { useTransition } from "react";
import { updateSprintStatus } from "@/services/sprint-actions";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle2 } from "lucide-react";
import type { SprintStatus } from "@prisma/client";

export function SprintActions({
  sprintId,
  currentStatus,
}: {
  sprintId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(status: SprintStatus) {
    startTransition(async () => {
      await updateSprintStatus(sprintId, status);
    });
  }

  if (currentStatus === "COMPLETED") return null;

  return (
    <div className="flex gap-2">
      {currentStatus === "PLANNING" && (
        <Button
          onClick={() => handleStatusChange("ACTIVE")}
          loading={isPending}
          size="sm"
        >
          <Play className="h-4 w-4 mr-1" />
          Start Sprint
        </Button>
      )}
      {currentStatus === "ACTIVE" && (
        <Button
          onClick={() => handleStatusChange("COMPLETED")}
          loading={isPending}
          size="sm"
          variant="secondary"
        >
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Complete Sprint
        </Button>
      )}
    </div>
  );
}
