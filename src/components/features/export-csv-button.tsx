"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export function ExportCsvButton({
  projectId,
  sprintId,
  label = "Export CSV",
}: {
  projectId?: string;
  sprintId?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);
      if (sprintId) params.set("sprintId", sprintId);

      const res = await fetch(`/api/export?${params}`);
      if (!res.ok) return;

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filename =
        disposition?.match(/filename="(.+)"/)?.[1] ?? "export.csv";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" />
      {loading ? "Exporting..." : label}
    </button>
  );
}
