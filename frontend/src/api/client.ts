import type { AgentCreateInput, GameState } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
}

export function createGame(seed?: number) {
  return api<GameState>("/api/games", {
    method: "POST",
    body: JSON.stringify({ map_id: "classic", seed: seed ?? null }),
  });
}

export function getGame(gameId: string) {
  return api<GameState>(`/api/games/${gameId}`);
}

export function addAgent(gameId: string, input: AgentCreateInput) {
  return api(`/api/games/${gameId}/players/agent`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function addHuman(gameId: string, name: string) {
  return api(`/api/games/${gameId}/players/human`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function startGame(gameId: string) {
  return api<GameState>(`/api/games/${gameId}/start`, {
    method: "POST",
  });
}

export function submitAction(gameId: string, action: Record<string, unknown>) {
  return api<{ accepted: boolean; errors: string[]; state: GameState }>(`/api/games/${gameId}/actions`, {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export function health() {
  return api<{ status: string }>("/api/health");
}
