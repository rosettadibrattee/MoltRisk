import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getGame, submitAction } from "../api/client";
import type { GameState } from "../api/types";
import { connectGameWs } from "../api/ws";
import { MapSvg } from "../components/map_svg";
import { PlayerTable } from "../components/player_table";
import { Timer } from "../components/timer";
import { TreatiesPanel } from "../components/treaties";
import { ChatPanel } from "../components/chat";
import { ActionLog } from "../components/log";

const empty: GameState = {
  game_id: "", status: "lobby", seed: 0, turn: 1, current_player: null,
  phase: "reinforce", turn_deadline_ts: null, players: [], territories: {},
  treaties: [], pending_treaty_offers: [], chat: [], log: [], winner: null,
};

export function GamePage() {
  const { gameId = "" } = useParams<{ gameId: string }>();
  const [state, setState] = useState<GameState>(empty);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!gameId) return;
    getGame(gameId).then(setState).catch((e) => setError(String(e)));
    const cleanup = connectGameWs(gameId, {
      onMessage: (env) => { if (env.type === "state") setState(env.payload as GameState); },
      onState: setConnected,
    });
    return cleanup;
  }, [gameId]);

  const currentPlayer = useMemo(
    () => state.players.find((p) => p.id === state.current_player),
    [state.players, state.current_player]
  );

  const submitBundle = async (bundle: Record<string, unknown>) => {
    if (!gameId) return;
    try {
      const r = await submitAction(gameId, bundle);
      if (!r.accepted && r.errors.length) setError(r.errors.join(" | "));
      else setError("");
    } catch (e) { setError(String(e)); }
  };

  return (
    <main className="game-page">
      {/* ─── Turn Bar ─── */}
      <header className="turn-bar">
        <span className="brand">MoltRisk</span>
        <div className="sep" />
        <div><span className="label">Turn</span> <span className="value">{state.turn}</span></div>
        <div className="sep" />
        <div>
          <span className="label">Player</span>{" "}
          <span className="value" style={{ color: currentPlayer?.color ?? "var(--text)" }}>
            {currentPlayer?.name ?? "—"}
          </span>
        </div>
        <div className="sep" />
        <div className="phase-indicator">
          {(["reinforce", "attack", "fortify"] as const).map((p) => (
            <span key={p} className={`phase-pill ${state.phase === p ? "active" : ""}`}>{p}</span>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <Timer deadlineTs={state.turn_deadline_ts} />
          <div className={`ws-dot ${connected ? "connected" : ""}`} title={connected ? "Connected" : "Reconnecting"} />
        </div>
      </header>

      {/* ─── Winner Banner ─── */}
      {state.winner && (
        <div className="winner-banner">
          Victory — {state.players.find((p) => p.id === state.winner)?.name ?? state.winner} wins!
        </div>
      )}

      {/* ─── Main Body ─── */}
      <div className="game-body">
        {/* Left sidebar: Treaties */}
        <div className="sidebar-left">
          <TreatiesPanel treaties={state.treaties} offers={state.pending_treaty_offers} />
          <PlayerTable players={state.players} currentPlayerId={state.current_player} />
        </div>

        {/* Center: Map */}
        <MapSvg territories={state.territories} players={state.players} />

        {/* Right sidebar: Players */}
        <div className="sidebar-right">
          <div className="panel">
            <h3>Game Info</h3>
            <div style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginTop: "0.4rem" }}>
              <div>Game: {state.game_id}</div>
              <div>Status: {state.status}</div>
              <div>Seed: {state.seed}</div>
              <div>Territories: {Object.keys(state.territories).length}</div>
            </div>
          </div>
          <div className="panel">
            <h3>Rules Quick Ref</h3>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.4rem", lineHeight: 1.5 }}>
              <div><strong style={{ color: "var(--text)" }}>Reinforce</strong> — Place armies on owned territories</div>
              <div><strong style={{ color: "var(--text)" }}>Attack</strong> — Roll dice against adjacent enemies</div>
              <div><strong style={{ color: "var(--text)" }}>Fortify</strong> — Move troops between connected territories</div>
              <div style={{ marginTop: "0.3rem" }}>Conquer ≥1 territory → draw a card</div>
              <div>NAP treaty blocks attacks between parties</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Footer: Chat + Log ─── */}
      <div className="game-footer">
        <div>
          <ChatPanel
            messages={state.chat}
            players={state.players}
            onSend={async (payload) => { await submitBundle({ phase_actions: [], chat: [payload] }); }}
          />
        </div>
        <div>
          <ActionLog events={state.log} />
        </div>
      </div>

      {error && <div className="error-bar">{error}</div>}
    </main>
  );
}
