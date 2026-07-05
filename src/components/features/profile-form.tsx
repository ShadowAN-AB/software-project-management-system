"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/services/settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

export function ProfileForm({
  name: initialName,
  email: initialEmail,
}: {
  name: string;
  email: string;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const hasChanges = name !== initialName || email !== initialEmail;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateProfile({ name, email });
      if (result.success) {
        setMessage({ type: "success", text: "Profile updated" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error ?? "Failed to update" });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Full Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
      </div>

      {message && (
        <p
          className={`text-xs px-3 py-2 rounded-lg ${
            message.type === "success"
              ? "text-emerald-700 bg-emerald-50"
              : "text-red-600 bg-red-50"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={isPending} disabled={!hasChanges}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
