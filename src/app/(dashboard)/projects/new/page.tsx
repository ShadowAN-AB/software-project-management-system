"use client";

import { useState, useActionState } from "react";
import { createProject, createProjectFromTemplate } from "@/services/project-actions";
import { PROJECT_TEMPLATES } from "@/lib/project-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, FileText, LayoutTemplate, Bug, Rocket, Globe, Check } from "lucide-react";
import type { ActionResult } from "@/types";

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  scrum: <LayoutTemplate className="h-5 w-5" />,
  "bug-tracking": <Bug className="h-5 w-5" />,
  "product-launch": <Rocket className="h-5 w-5" />,
  "website-redesign": <Globe className="h-5 w-5" />,
};

export default function NewProjectPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [blankState, blankAction, blankPending] = useActionState<ActionResult | null, FormData>(
    createProject,
    null
  );
  const [templateState, templateAction, templatePending] = useActionState<ActionResult | null, FormData>(
    createProjectFromTemplate,
    null
  );

  const isBlank = selectedTemplate === "blank";
  const state = isBlank ? blankState : templateState;
  const pending = isBlank ? blankPending : templatePending;

  if (selectedTemplate === null) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Create New Project</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Start from scratch or choose a template to get going faster.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setSelectedTemplate("blank")}
            className="text-left p-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-zinc-800/50 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-zinc-900">Blank Project</h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Start with an empty project — add tasks and labels as you go.
            </p>
          </button>

          {PROJECT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className="text-left p-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-zinc-800/50 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {TEMPLATE_ICONS[t.id] ?? <LayoutTemplate className="h-5 w-5" />}
                </div>
                <h3 className="font-semibold text-zinc-900">{t.name}</h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.description}</p>
              <div className="flex gap-3 mt-3 text-xs text-zinc-400 dark:text-zinc-500">
                <span>{t.tasks.length} tasks</span>
                <span>{t.labels.length} labels</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const template = PROJECT_TEMPLATES.find((t) => t.id === selectedTemplate);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => setSelectedTemplate(null)}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to templates
      </button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">
              {isBlank ? "Create New Project" : `New Project from "${template?.name}"`}
            </h1>
            {template && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {template.tasks.length} tasks · {template.labels.length} labels
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form action={isBlank ? blankAction : templateAction} className="space-y-4">
            {!isBlank && <input type="hidden" name="templateId" value={selectedTemplate} />}

            {state && !state.success && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
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
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="block w-full rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="What's this project about?"
                defaultValue={template?.description ?? ""}
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

            {template && (
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Template will create
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Labels</p>
                    <div className="flex flex-wrap gap-1.5">
                      {template.labels.map((l) => (
                        <span
                          key={l.name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: l.color + "20", color: l.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tasks</p>
                    <ul className="space-y-1">
                      {template.tasks.slice(0, 5).map((t) => (
                        <li key={t.title} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          <Check className="h-3 w-3 text-zinc-400" />
                          {t.title}
                        </li>
                      ))}
                      {template.tasks.length > 5 && (
                        <li className="text-xs text-zinc-400 dark:text-zinc-500 pl-5">
                          +{template.tasks.length - 5} more tasks
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

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
