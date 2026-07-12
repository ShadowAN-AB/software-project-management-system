"use client";

import { useActionState } from "react";
import { createWorkspace } from "@/services/workspace-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/types";

export function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createWorkspace,
    null
  );

  return (
    <form action={action} className="space-y-4">
      {state && !state.success && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
          {state.error}
        </div>
      )}
      <Input
        id="name"
        name="name"
        label="Workspace name"
        placeholder="Acme Inc."
        maxLength={60}
        required
      />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create workspace"}
      </Button>
    </form>
  );
}
