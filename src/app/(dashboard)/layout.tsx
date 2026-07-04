import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/features/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userName={session.user.name} userRole={session.user.role} />
      <main className="flex-1 overflow-y-auto bg-zinc-50/50 p-8">{children}</main>
    </div>
  );
}
