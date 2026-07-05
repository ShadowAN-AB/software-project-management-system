import { NextResponse } from "next/server";
import { checkDueDateReminders } from "@/services/due-date-reminder-actions";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkDueDateReminders();
  return NextResponse.json(result);
}
