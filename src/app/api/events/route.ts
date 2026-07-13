import { auth } from "@/lib/auth";
import { eventBus } from "@/lib/event-bus";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const channelsParam = req.nextUrl.searchParams.get("channels") || "";
  const channels = channelsParam
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  // Only allow user-scoped channels that address THIS user, so a client can't
  // eavesdrop on someone else's notifications by guessing a channel name.
  const userPrefix = `user:${session.user.id}`;
  const safeChannels = channels.filter(
    (c) => !c.startsWith("user:") || c === userPrefix || c.startsWith(`${userPrefix}:`)
  );

  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribes: (() => void)[] = [];

      for (const channel of safeChannels) {
        const unsub = eventBus.subscribe(channel, (event) => {
          try {
            const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          } catch {
            // Client disconnected
          }
        });
        unsubscribes.push(unsub);
      }

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      cleanup = () => {
        clearInterval(heartbeat);
        for (const unsub of unsubscribes) unsub();
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
