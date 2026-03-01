export type GameStatus = "lobby" | "running" | "finished";
export type Phase = "reinforce" | "attack" | "fortify";

export interface Personality {
  aggression: number;
  deception: number;
  cooperation: number;
  risk: number;
}

export interface Mission {
  type: "control_24" | "control_18_two_armies" | "control_continents" | "destroy_player";
  target_player?: string | null;
  continents?: string[] | null;
}

export interface Player {
  id: string;
  name: string;
  kind: "agent" | "human";
  alive: boolean;
  color: string;
  armies_in_hand: number;
  cards: string[];
  mission: Mission;
  reputation: number;
  personality: Personality;
  tier: "easy" | "normal" | "hard";
}

export interface TerritoryState {
  owner: string;
  armies: number;
}

export interface Treaty {
  id: string;
  type: "non_aggression" | "trade";
  players: string[];
  expires_turn: number;
  created_turn: number;
}

export interface TreatyOffer {
  id: string;
  from_player: string;
  to_player: string;
  type: "non_aggression" | "trade";
  duration_turns: number;
  created_turn: number;
}

export interface ChatMessage {
  id: string;
  ts: number;
  from_player: string;
  to_player?: string | null;
  channel: "public" | "dm" | "system";
  text: string;
}

export interface GameEvent {
  id: string;
  ts: number;
  type: string;
  data: Record<string, unknown>;
}

export interface GameState {
  game_id: string;
  status: GameStatus;
  seed: number;
  turn: number;
  current_player: string | null;
  phase: Phase;
  turn_deadline_ts: number | null;
  players: Player[];
  territories: Record<string, TerritoryState>;
  treaties: Treaty[];
  pending_treaty_offers: TreatyOffer[];
  chat: ChatMessage[];
  log: GameEvent[];
  winner?: string | null;
}

export interface WsEnvelope {
  type: "state" | "event";
  payload: GameState | GameEvent;
}

export interface AgentCreateInput {
  name: string;
  provider: "heuristic" | "ollama" | "openai_compat";
  model: string;
  endpoint: string;
  api_key?: string | null;
  personality: Personality;
  tier: "easy" | "normal" | "hard";
}
