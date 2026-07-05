import type { SSEFrame } from "@/lib/sse-events";

type Listener = (event: SSEFrame) => void;

class EventBus {
  private channels = new Map<string, Set<Listener>>();

  subscribe(channel: string, listener: Listener): () => void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(listener);

    return () => {
      const listeners = this.channels.get(channel);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) this.channels.delete(channel);
      }
    };
  }

  emit(channels: string | string[], event: SSEFrame) {
    const targets = Array.isArray(channels) ? channels : [channels];
    for (const channel of targets) {
      const listeners = this.channels.get(channel);
      if (listeners) {
        for (const listener of listeners) {
          listener(event);
        }
      }
    }
  }
}

const globalForBus = globalThis as unknown as { eventBus: EventBus };

export const eventBus = globalForBus.eventBus || new EventBus();

if (process.env.NODE_ENV !== "production") globalForBus.eventBus = eventBus;
