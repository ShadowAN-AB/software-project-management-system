"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { createSprint } from "@/services/sprint-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ActionResult } from "@/types";
import { Suspense } from "react";

function NewSprintForm() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createSprint,
    null
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={projectId ? `/projects/${projectId}` : "/sprints"}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <Card>
        <CardHeader>
          <h1 className="text-xl font-bold text-gray-900">Create New Sprint</h1>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <input type="hidden" name="projectId" value={projectId} />

            {state && !state.success && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {state.error}
              </div>
            )}

            <Input
              id="name"
              name="name"
              label="Sprint Name"
              placeholder="Sprint 1"
              required
            />

            <div className="space-y-1">
              <label htmlFor="goal" className="block text-sm font-medium text-gray-700">
                Sprint Goal
              </label>
              <textarea
                id="goal"
                name="goal"
                rows={2}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="What do we aim to achieve?"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="startDate"
                name="startDate"
                type="date"
                label="Start Date"
                required
              />
              <Input
                id="endDate"
                name="endDate"
                type="date"
                label="End Date"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link href={projectId ? `/projects/${projectId}` : "/sprints"}>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" loading={pending}>
                Create Sprint
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewSprintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <NewSprintForm />
    </Suspense>
  );
}
