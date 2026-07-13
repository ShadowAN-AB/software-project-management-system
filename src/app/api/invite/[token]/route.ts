import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateInviteToken } from "@/services/invite-actions";

// Bare invite-link landing. Routes to the right place based on session:
//   - Not signed in                  → /register?token=<token> (email pre-fill)
//   - Signed in, email matches       → /invitations (accept from here)
//   - Signed in, different email     → /invitations with an error banner
//   - Bad / expired token            → /login?invite=expired
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invite = await validateInviteToken(token);
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  if (!invite) {
    return NextResponse.redirect(new URL("/login?invite=expired", base));
  }

  const session = await auth();
  if (!session?.user) {
    const url = new URL("/register", base);
    url.searchParams.set("token", token);
    return NextResponse.redirect(url);
  }

  const url = new URL("/invitations", base);
  if (session.user.email?.toLowerCase() !== invite.email) {
    url.searchParams.set("mismatch", "1");
  }
  return NextResponse.redirect(url);
}
