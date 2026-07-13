"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronsUpDown, Check, Plus, Building2, Mail } from "lucide-react";
import { switchWorkspace } from "@/services/workspace-actions";

type Workspace = { id: string; slug: string; name: string; role: string };

export function WorkspaceSwitcher({
  workspaces,
  pendingInvitationsCount = 0,
  collapsed = false,
}: {
  workspaces: Workspace[];
  pendingInvitationsCount?: number;
  collapsed?: boolean;
}) {
  const router = useRouter();
  const params = useParams();
  const currentSlug = params.workspaceSlug as string | undefined;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = workspaces.find((w) => w.slug === currentSlug) ?? workspaces[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/5 transition-colors ${
          collapsed ? "justify-center" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="relative h-7 w-7 rounded-md bg-white/10 border border-white/10 text-white flex items-center justify-center flex-shrink-0">
          <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          {pendingInvitationsCount > 0 && (
            <span
              className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-emerald-500 text-[10px] font-semibold text-zinc-950 flex items-center justify-center"
              aria-label={`${pendingInvitationsCount} pending invitation${pendingInvitationsCount === 1 ? "" : "s"}`}
            >
              {pendingInvitationsCount}
            </span>
          )}
        </div>
        {!collapsed && (
          <>
            <span className="text-sm font-medium text-white truncate flex-1">
              {current?.name ?? "No workspace"}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" strokeWidth={1.75} />
          </>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg bg-zinc-900 border border-zinc-800 shadow-xl overflow-hidden">
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {workspaces.map((w) => (
              <li key={w.id}>
                <form
                  action={async () => {
                    await switchWorkspace(w.slug);
                  }}
                >
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-zinc-200 hover:bg-white/5"
                    role="option"
                    aria-selected={w.slug === currentSlug}
                  >
                    <span className="flex-1 truncate">{w.name}</span>
                    {w.slug === currentSlug && (
                      <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
                    )}
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {pendingInvitationsCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/invitations");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 border-t border-zinc-800 hover:bg-white/5"
            >
              <Mail className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="flex-1 text-left">Pending invitations</span>
              <span className="h-4 min-w-[16px] px-1 rounded-full bg-emerald-500 text-[10px] font-semibold text-zinc-950 flex items-center justify-center">
                {pendingInvitationsCount}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/onboarding/create-workspace");
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 border-t border-zinc-800 hover:bg-white/5"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Create workspace
          </button>
        </div>
      )}
    </div>
  );
}
