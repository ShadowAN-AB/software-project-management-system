export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/tasks/:path*", "/sprints/:path*", "/admin/:path*", "/notifications/:path*", "/settings/:path*", "/reports/:path*", "/activity/:path*", "/workload/:path*", "/setup/:path*"],
};
