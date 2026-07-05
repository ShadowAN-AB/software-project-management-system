import { NextRequest, NextResponse } from "next/server";
import { validateInviteToken } from "@/services/invite-actions";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const invite = await validateInviteToken(token);

  if (!invite) {
    return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
  }

  return NextResponse.json(invite);
}
