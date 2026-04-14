import type { AgentCreateInput, GameState } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

export const createGame = (seed?: number) =>
  api<GameState>("/api/games", { method: "POST", body: JSON.stringify({ map_id: "classic", seed: seed ?? null }) });

export const getGame = (id: string) => api<GameState>(`/api/games/${id}`);

export const addAgent = (id: string, input: AgentCreateInput) =>
  api(`/api/games/${id}/players/agent`, { method: "POST", body: JSON.stringify(input) });

export const addHuman = (id: string, name: string) =>
  api(`/api/games/${id}/players/human`, { method: "POST", body: JSON.stringify({ name }) });

export const startGame = (id: string) =>
  api<GameState>(`/api/games/${id}/start`, { method: "POST" });

export const submitAction = (id: string, action: Record<string, unknown>) =>
  api<{ accepted: boolean; errors: string[]; state: GameState }>(`/api/games/${id}/actions`, { method: "POST", body: JSON.stringify(action) });

export const health = () => api<{ status: string }>("/api/health");
