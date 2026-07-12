import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 renames middleware to proxy. We use this seam to sync the
// `lastWorkspaceSlug` cookie with the URL so client-invoked server actions
// (which can't read URL params) resolve to the same workspace as the page
// the user is currently on. Auth-gating is handled by the (dashboard) layout.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/w\/([^/]+)(?:\/|$)/);
  if (!match) return NextResponse.next();

  const slug = match[1];
  if (request.cookies.get("lastWorkspaceSlug")?.value === slug) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set("lastWorkspaceSlug", slug, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return response;
}

export const config = {
  matcher: ["/w/:path*"],
};
