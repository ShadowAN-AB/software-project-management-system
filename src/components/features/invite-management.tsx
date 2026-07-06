"use client";

import { useState, useTransition } from "react";
import { createInvitation, revokeInvitation } from "@/services/invite-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mail,
  Copy,
  Check,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Invitation = {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  invitedBy: { name: string };
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  DEVELOPER: "Developer",
  TESTER: "Tester",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "text-amber-600 bg-amber-50 border-amber-200",
  PROJECT_MANAGER: "text-violet-600 bg-violet-50 border-violet-200",
  DEVELOPER: "text-blue-600 bg-blue-50 border-blue-200",
  TESTER: "text-emerald-600 bg-emerald-50 border-emerald-200",
};

function getInviteStatus(invite: Invitation) {
  if (invite.usedAt) return "used";
  if (new Date(invite.expiresAt) < new Date()) return "expired";
  return "pending";
}

export function InviteManagement({
  invitations,
}: {
  invitations: Invitation[];
}) {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("DEVELOPER");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await createInvitation(
        email,
        role as "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER" | "TESTER"
      );

      if (result.success) {
        const token = result.data.token;
        const link = `${window.location.origin}/register?token=${token}`;
        await navigator.clipboard.writeText(link);
        setSuccess("Invitation created! Link copied to clipboard.");
        setEmail("");
      } else {
        setError(result.error ?? "Failed to create invitation");
      }
    });
  }

  function handleRevoke(id: string) {
    if (!confirm("Revoke this invitation?")) return;
    setError(null);
    startTransition(async () => {
      const result = await revokeInvitation(id);
      if (!result.success) setError(result.error ?? "Failed to revoke");
    });
  }

  function copyLink(token: string, id: string) {
    const link = `${window.location.origin}/register?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const pendingInvites = invitations.filter(
    (i) => getInviteStatus(i) === "pending"
  );
  const pastInvites = invitations.filter(
    (i) => getInviteStatus(i) !== "pending"
  );

  return (
    <div className="space-y-6">
      {/* Create Invitation */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Invite Team Member
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                id="invite-email"
                name="email"
                type="email"
                label="Email address"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                required
              />
            </div>
            <div className="w-44">
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-10 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 bg-white dark:bg-zinc-800 dark:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="ADMIN">Admin</option>
                <option value="PROJECT_MANAGER">Project Manager</option>
                <option value="DEVELOPER">Developer</option>
                <option value="TESTER">Tester</option>
              </select>
            </div>
            <Button type="submit" loading={isPending} className="gap-2 h-10">
              <Mail className="h-4 w-4" />
              Invite
            </Button>
          </form>

          {error && (
            <p className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-3 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
              {success}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Pending Invitations
            </h2>
            <span className="text-xs text-zinc-400">
              {pendingInvites.length} pending
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {pendingInvites.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Mail
                className="h-8 w-8 text-zinc-200 mx-auto mb-2"
                strokeWidth={1.5}
              />
              <p className="text-sm text-zinc-400">No pending invitations</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className={`px-6 py-3.5 flex items-center gap-4 ${
                    isPending ? "opacity-60" : ""
                  }`}
                >
                  <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Mail
                      className="h-4 w-4 text-blue-500"
                      strokeWidth={1.75}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {invite.email}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Invited by {invite.invitedBy.name} &middot; Expires{" "}
                      {formatDistanceToNow(new Date(invite.expiresAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                      ROLE_COLORS[invite.role] ?? ROLE_COLORS.DEVELOPER
                    }`}
                  >
                    {ROLE_LABELS[invite.role] ?? invite.role}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyLink(invite.token, invite.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                      title="Copy invite link"
                    >
                      {copiedId === invite.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Revoke invitation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Invitations */}
      {pastInvites.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Past Invitations
            </h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-100">
              {pastInvites.map((invite) => {
                const status = getInviteStatus(invite);
                return (
                  <div
                    key={invite.id}
                    className="px-6 py-3 flex items-center gap-4 opacity-60"
                  >
                    <div className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                      {status === "used" ? (
                        <CheckCircle2
                          className="h-4 w-4 text-emerald-500"
                          strokeWidth={1.75}
                        />
                      ) : (
                        <XCircle
                          className="h-4 w-4 text-zinc-400"
                          strokeWidth={1.75}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-700 truncate">
                        {invite.email}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {status === "used" ? "Registered" : "Expired"}{" "}
                        {formatDistanceToNow(
                          new Date(invite.usedAt ?? invite.expiresAt),
                          { addSuffix: true }
                        )}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                        ROLE_COLORS[invite.role] ?? ROLE_COLORS.DEVELOPER
                      }`}
                    >
                      {ROLE_LABELS[invite.role] ?? invite.role}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        status === "used" ? "text-emerald-500" : "text-zinc-400"
                      }`}
                    >
                      {status === "used" ? "Used" : "Expired"}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
