"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  FolderKanban,
  ListTodo,
  User,
  X,
} from "lucide-react";
import { globalSearch } from "@/services/search-actions";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

type SearchResults = {
  projects: { id: string; name: string; key: string; status: string }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    project: { key: string };
  }[];
  users: { id: string; name: string; email: string; role: string }[];
};

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const router = useRouter();

  // Cmd+K to open
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    const res = await globalSearch(q);
    setResults(res);
    setLoading(false);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  function navigate(path: string) {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(path);
  }

  const hasResults =
    results &&
    (results.projects.length > 0 ||
      results.tasks.length > 0 ||
      results.users.length > 0);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 text-sm text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 transition-all bg-white"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 bg-zinc-100 rounded border border-zinc-200">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50">
        <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
            <Search
              className={`h-4.5 w-4.5 flex-shrink-0 ${
                loading ? "text-blue-500 animate-pulse" : "text-zinc-400"
              }`}
              strokeWidth={1.75}
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Search projects, tasks, users..."
              className="flex-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none bg-transparent"
            />
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          {query.trim() && (
            <div className="max-h-[360px] overflow-y-auto">
              {!results && loading && (
                <div className="py-8 text-center text-sm text-zinc-400">
                  Searching...
                </div>
              )}

              {results && !hasResults && (
                <div className="py-8 text-center text-sm text-zinc-400">
                  No results for &ldquo;{query}&rdquo;
                </div>
              )}

              {results?.projects && results.projects.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide bg-zinc-50">
                    Projects
                  </p>
                  {results.projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors text-left"
                    >
                      <FolderKanban
                        className="h-4 w-4 text-zinc-400 flex-shrink-0"
                        strokeWidth={1.75}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-900 truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-zinc-400 font-mono">
                          {p.key}
                        </p>
                      </div>
                      <StatusBadge status={p.status} />
                    </button>
                  ))}
                </div>
              )}

              {results?.tasks && results.tasks.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide bg-zinc-50">
                    Tasks
                  </p>
                  {results.tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/tasks/${t.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors text-left"
                    >
                      <ListTodo
                        className="h-4 w-4 text-zinc-400 flex-shrink-0"
                        strokeWidth={1.75}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-900 truncate">
                          {t.title}
                        </p>
                        <p className="text-xs text-zinc-400 font-mono">
                          {t.project.key}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results?.users && results.users.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide bg-zinc-50">
                    Users
                  </p>
                  {results.users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => navigate("/admin")}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors text-left"
                    >
                      <User
                        className="h-4 w-4 text-zinc-400 flex-shrink-0"
                        strokeWidth={1.75}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-900 truncate">
                          {u.name}
                        </p>
                        <p className="text-xs text-zinc-400">{u.email}</p>
                      </div>
                      <span className="text-xs text-zinc-400">
                        {u.role.replace("_", " ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-zinc-100 flex items-center gap-4 text-xs text-zinc-400">
            <span>↑↓ Navigate</span>
            <span>↵ Open</span>
            <span>esc Close</span>
          </div>
        </div>
      </div>
    </>
  );
}
