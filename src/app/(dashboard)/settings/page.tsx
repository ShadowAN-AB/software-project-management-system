import { getProfile } from "@/services/settings-actions";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Settings, User, Lock, Bell } from "lucide-react";
import { ProfileForm } from "@/components/features/profile-form";
import { PasswordForm } from "@/components/features/password-form";
import { formatDistanceToNow } from "date-fns";

export default async function SettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4.5 w-4.5 text-zinc-400" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
              Profile
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">
                {profile.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-900">
                {profile.name}
              </p>
              <p className="text-sm text-zinc-500">{profile.email}</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {profile.role.replace("_", " ")} &middot; Joined{" "}
                {formatDistanceToNow(new Date(profile.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
          <ProfileForm name={profile.name} email={profile.email} />
        </CardContent>
      </Card>

      {/* Password Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4.5 w-4.5 text-zinc-400" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">
              Change Password
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
