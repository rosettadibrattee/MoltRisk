import type { WsEnvelope } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

function wsBaseFromHttp(httpUrl: string): string {
  return httpUrl.replace(/^http/, "ws");
}

export function connectGameWs(
  gameId: string,
  handlers: {
    onMessage: (envelope: WsEnvelope) => void;
    onState?: (connected: boolean) => void;
  },
) {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retries = 0;

  const connect = () => {
    if (stopped) {
      return;
    }
    socket = new WebSocket(`${wsBaseFromHttp(API_BASE)}/ws/games/${gameId}`);

    socket.onopen = () => {
      retries = 0;
      handlers.onState?.(true);
      socket?.send("hello");
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WsEnvelope;
        handlers.onMessage(parsed);
      } catch {
        // Ignore malformed socket payloads.
      }
    };

    socket.onclose = () => {
      handlers.onState?.(false);
      if (stopped) {
        return;
      }
      retries += 1;
      const delay = Math.min(5000, 500 * retries);
      window.setTimeout(connect, delay);
    };

    socket.onerror = () => {
      socket?.close();
    };
  };

  connect();

  return () => {
    stopped = true;
    socket?.close();
  };
}
