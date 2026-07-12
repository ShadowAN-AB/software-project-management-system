import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// Bare auth gate. Sub-routes render their own chrome:
// - /w/[workspaceSlug]/… → workspace layout with DashboardShell + Sidebar.
// - /onboarding/create-workspace → minimal centered card.
// - /invitations → slim standalone page.
export default async function DashboardAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <>{children}</>;
}
