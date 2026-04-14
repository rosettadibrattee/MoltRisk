import type { WsEnvelope } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const wsBase = (url: string) => url.replace(/^http/, "ws");

export function connectGameWs(
  gameId: string,
  handlers: { onMessage: (env: WsEnvelope) => void; onState?: (connected: boolean) => void },
) {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retries = 0;

  const connect = () => {
    if (stopped) return;
    socket = new WebSocket(`${wsBase(API_BASE)}/ws/games/${gameId}`);
    socket.onopen = () => { retries = 0; handlers.onState?.(true); socket?.send("ping"); };
    socket.onmessage = (e) => { try { handlers.onMessage(JSON.parse(e.data)); } catch {} };
    socket.onclose = () => {
      handlers.onState?.(false);
      if (stopped) return;
      retries++;
      setTimeout(connect, Math.min(5000, 500 * retries));
    };
    socket.onerror = () => socket?.close();
  };

  connect();
  return () => { stopped = true; socket?.close(); };
}
