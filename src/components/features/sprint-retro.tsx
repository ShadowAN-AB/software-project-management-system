"use client";

import { useState } from "react";
import { generateSprintRetro } from "@/services/ai-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

export function SprintRetro({ sprintId }: { sprintId: string }) {
  const [retro, setRetro] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setPending(true);
    const result = await generateSprintRetro(sprintId);
    setPending(false);
    if (result.success) {
      setRetro(result.data);
    } else {
      setError(result.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
              AI Retrospective
            </h2>
          </div>
          {retro && (
            <button
              onClick={handleGenerate}
              disabled={pending}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Regenerate
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!retro && !pending && (
          <div className="text-center py-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
              Analyze this sprint&apos;s metrics and produce a retrospective.
            </p>
            <Button onClick={handleGenerate}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Generate retrospective
            </Button>
          </div>
        )}

        {pending && !retro && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing sprint…
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        )}

        {retro && (
          <div className="prose prose-sm max-w-none text-sm text-zinc-800 dark:text-zinc-200 space-y-2">
            {renderRetro(retro)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function renderRetro(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line) {
      out.push(<div key={i} className="h-2" />);
      return;
    }

    const boldHeading = line.match(/^\*\*(.+?)\*\*$/);
    if (boldHeading) {
      out.push(
        <h3 key={i} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-3">
          {boldHeading[1]}
        </h3>
      );
      return;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      out.push(
        <div key={i} className="flex gap-2 pl-1">
          <span className="text-zinc-400">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
      return;
    }

    out.push(<p key={i}>{renderInline(line)}</p>);
  });

  return out;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
