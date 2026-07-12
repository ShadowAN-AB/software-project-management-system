import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase, ATTACHMENTS_BUCKET } from "@/lib/supabase";
import { requireProjectMember, getTaskProjectId } from "@/lib/authorization";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: { taskId: true, storagePath: true, filename: true },
  });

  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const projectId = await getTaskProjectId(attachment.taskId);
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isMember = await requireProjectMember(projectId, session.user.id, session.user.role);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.storagePath, 60, { download: attachment.filename });

  if (error || !data) {
    return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 });
  }

  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
