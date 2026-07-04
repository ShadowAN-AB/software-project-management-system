"use client";

import { useActionState } from "react";
import { createProject } from "@/services/project-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ActionResult } from "@/types";

export default function NewProjectPage() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createProject,
    null
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <Card>
        <CardHeader>
          <h1 className="text-xl font-bold text-gray-900">Create New Project</h1>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            {state && !state.success && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {state.error}
              </div>
            )}

            <Input
              id="name"
              name="name"
              label="Project Name"
              placeholder="My Awesome Project"
              required
            />

            <Input
              id="key"
              name="key"
              label="Project Key"
              placeholder="MAP"
              maxLength={6}
              className="uppercase"
              required
            />
            <p className="text-xs text-gray-400 -mt-2">
              2-6 uppercase letters, used as task prefix
            </p>

            <div className="space-y-1">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="What's this project about?"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="startDate"
                name="startDate"
                type="date"
                label="Start Date"
              />
              <Input
                id="endDate"
                name="endDate"
                type="date"
                label="End Date"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link href="/projects">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" loading={pending}>
                Create Project
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
