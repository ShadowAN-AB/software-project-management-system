"use client";

import { useEffect, useRef, useCallback } from "react";
import type { SSEFrame } from "@/lib/sse-events";

type EventHandler = (event: SSEFrame) => void;
type HandlerMap = Partial<Record<SSEFrame["type"], EventHandler>>;

export function useEventStream({
  channels,
  handlers,
  currentUserId,
  skipOwnEvents = true,
}: {
  channels: string[];
  handlers: HandlerMap;
  currentUserId: string;
  skipOwnEvents?: boolean;
}) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  // Even with no explicit channels, the server auto-subscribes user:{userId}
  const channelKey = channels.length > 0 ? channels.sort().join(",") : "__user_only__";

  const onMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data: SSEFrame = JSON.parse(event.data);
        if (skipOwnEvents && data._actorId === currentUserId) return;
        const handler = handlersRef.current[data.type];
        if (handler) handler(data);
      } catch {
        // Ignore malformed events
      }
    },
    [currentUserId, skipOwnEvents]
  );

  useEffect(() => {
    let es: EventSource | null = null;
    let retryDelay = 1000;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let unmounted = false;

    function connect() {
      if (unmounted) return;

      const channelParam = channels.length > 0 ? channels.sort().join(",") : "";
      const url = `/api/events?channels=${encodeURIComponent(channelParam)}`;
      es = new EventSource(url);

      es.onopen = () => {
        retryDelay = 1000;
      };

      es.onmessage = onMessage;

      // SSE sends named events — need to listen for each type
      const eventTypes = [
        "task:created",
        "task:statusChanged",
        "task:updated",
        "task:deleted",
        "comment:added",
        "notification:created",
        "sprint:statusChanged",
      ];
      for (const type of eventTypes) {
        es.addEventListener(type, onMessage as EventListener);
      }

      es.onerror = () => {
        es?.close();
        if (unmounted) return;
        retryTimeout = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30_000);
          connect();
        }, retryDelay);
      };
    }

    connect();

    return () => {
      unmounted = true;
      clearTimeout(retryTimeout);
      es?.close();
    };
    // channels is intentionally excluded — channelKey is the sorted-joined
    // stable identity we actually depend on; the array itself changes each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, onMessage]);
}
