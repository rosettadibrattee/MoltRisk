import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { getGame, submitAction } from "../api/client";
import type { GameState } from "../api/types";
import { connectGameWs } from "../api/ws";
import { ActionLog } from "../components/log";
import { MapSvg } from "../components/map_svg";
import { PlayerTable } from "../components/player_table";
import { Timer } from "../components/timer";
import { TreatiesPanel } from "../components/treaties";
import { ChatPanel } from "../components/chat";
import adjacencyRaw from "../assets/adjacency.json";

const ADJACENCY = adjacencyRaw as Record<string, string[]>;

const PHASES = ["reinforce", "attack", "fortify"] as const;
const PHASE_LABELS: Record<string, string> = {
  reinforce: "Reinforce",
  attack: "Attack",
  fortify: "Fortify",
};

const emptyState: GameState = {
  game_id: "",
  status: "lobby",
  seed: 0,
  turn: 1,
  current_player: null,
  phase: "reinforce",
  turn_deadline_ts: null,
  players: [],
  territories: {},
  treaties: [],
  pending_treaty_offers: [],
  chat: [],
  log: [],
  winner: null,
};

export function GamePage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? "";

  const [state, setState] = useState<GameState>(emptyState);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [yourTurnVisible, setYourTurnVisible] = useState(false);

  const [actor, setActor] = useState("");
  const [reinforceTarget, setReinforceTarget] = useState("");
  const [reinforceUnits, setReinforceUnits] = useState(1);
  const [attackFrom, setAttackFrom] = useState("");
  const [attackTo, setAttackTo] = useState("");
  const [attackDice, setAttackDice] = useState(1);
  const [fortifyFrom, setFortifyFrom] = useState("");
  const [fortifyTo, setFortifyTo] = useState("");
  const [fortifyUnits, setFortifyUnits] = useState(1);

  const [lowerHeight, setLowerHeight] = useState(260);
  const lowerDragRef = useRef<{ startY: number; startH: number } | null>(null);

  const prevCurrentPlayer = useRef<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    let cleanup = () => {};
    getGame(gameId)
      .then((game) => {
        setState(game);
        const firstHuman = game.players.find((p) => p.kind === "human")?.id ?? "";
        setActor(firstHuman);
      })
      .catch((err) => setError(String(err)));

    cleanup = connectGameWs(gameId, {
      onMessage: (envelope) => {
        if (envelope.type === "state") setState(envelope.payload as GameState);
      },
      onState: setConnected,
    });

    return cleanup;
  }, [gameId]);

  const humanPlayers = useMemo(
    () => state.players.filter((p) => p.kind === "human"),
    [state.players],
  );

  useEffect(() => {
    if (!actor && humanPlayers[0]) setActor(humanPlayers[0].id);
  }, [actor, humanPlayers]);

  // Flash "Your Turn" banner when current_player transitions to this human actor
  useEffect(() => {
    if (
      actor &&
      state.current_player === actor &&
      state.status === "running" &&
      prevCurrentPlayer.current !== actor
    ) {
      setYourTurnVisible(true);
      const t = setTimeout(() => setYourTurnVisible(false), 2800);
      prevCurrentPlayer.current = actor;
      return () => clearTimeout(t);
    }
    prevCurrentPlayer.current = state.current_player;
  }, [state.current_player, actor, state.status]);

  const isActiveHumanTurn =
    !!actor && state.current_player === actor && state.status === "running";

  // Derive playerColors map for map coloring
  const playerColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of state.players) {
      if (p.color) map[p.id] = p.color;
    }
    return map;
  }, [state.players]);

  // Filtered territory lists for Human Actions controls
  const ownedTerritories = useMemo(
    () =>
      Object.entries(state.territories)
        .filter(([, st]) => (st as { owner?: string }).owner === actor)
        .map(([id]) => id)
        .sort(),
    [state.territories, actor],
  );

  const attackFromTerritories = useMemo(
    () => ownedTerritories.filter((id) => (state.territories[id]?.armies ?? 0) > 1),
    [ownedTerritories, state.territories],
  );

  const attackToTerritories = useMemo(() => {
    if (!attackFrom) return [];
    return (ADJACENCY[attackFrom] ?? []).filter(
      (id) => state.territories[id]?.owner !== actor,
    );
  }, [attackFrom, actor, state.territories]);

  const fortifyFromTerritories = useMemo(
    () => ownedTerritories.filter((id) => (state.territories[id]?.armies ?? 0) > 1),
    [ownedTerritories, state.territories],
  );

  const fortifyToTerritories = useMemo(() => {
    if (!fortifyFrom) return [];
    return (ADJACENCY[fortifyFrom] ?? []).filter(
      (id) => state.territories[id]?.owner === actor,
    );
  }, [fortifyFrom, actor, state.territories]);

  const submitBundle = async (bundle: Record<string, unknown>) => {
    if (!gameId) return;
    try {
      const response = await submitAction(gameId, bundle);
      if (!response.accepted && response.errors.length) {
        setError(response.errors.join(" | "));
      } else {
        setError("");
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const endPhase = () => submitBundle({ phase_actions: [], chat: [] });

  const shortId = state.game_id ? state.game_id.slice(0, 12) + "…" : "—";
  const currentPlayerInfo = state.players.find((p) => p.id === state.current_player);
  const phaseIndex = PHASES.indexOf(state.phase as typeof PHASES[number]);

  return (
    <main className="game-page">
      {/* "Your Turn" flash banner */}
      {yourTurnVisible && (
        <div className="your-turn-overlay" onClick={() => setYourTurnVisible(false)}>
          <div className="your-turn-card">
            <span className="your-turn-label">Your Turn</span>
            <span className="your-turn-sub">
              {humanPlayers.find((p) => p.id === actor)?.name ?? actor} — start reinforcing
            </span>
          </div>
        </div>
      )}

      {/* Status bar */}
      <header className="status-bar">
        <span className="status-bar-title">MoltRisk</span>

        <div className="status-item">
          <span className="s-label">Game</span>
          <span className="s-value">{shortId}</span>
        </div>
        <div className="status-sep" />
        <div className="status-item">
          <span className="s-label">Turn</span>
          <span className="s-value">{state.turn}</span>
        </div>
        <div className="status-sep" />

        {/* Active player with color dot */}
        <div className="status-item">
          <span className="s-label">Active</span>
          <span className="s-value status-player-chip">
            {currentPlayerInfo && (
              <span
                className="status-player-dot"
                style={{ background: currentPlayerInfo.color }}
              />
            )}
            {state.current_player ?? "—"}
          </span>
        </div>
        <div className="status-sep" />

        {/* Phase stepper inline in status bar */}
        <div className="status-phase-stepper">
          {PHASES.map((p, i) => (
            <span
              key={p}
              className={[
                "status-phase-step",
                i === phaseIndex ? "is-active" : "",
                i < phaseIndex ? "is-done" : "",
              ].filter(Boolean).join(" ")}
            >
              {i < phaseIndex ? "✓" : i + 1} {PHASE_LABELS[p]}
            </span>
          ))}
        </div>
        <div className="status-sep" />

        <div className="status-item">
          <span className="s-label">Timer</span>
          <span className="s-value">
            <Timer deadlineTs={state.turn_deadline_ts} />
          </span>
        </div>
        <div className="status-sep" />
        <span
          className={`chip chip--dot ${connected ? "chip--success" : "chip--warning"}`}
          style={{ marginLeft: "0.25rem" }}
        >
          {connected ? "Live" : "Reconnecting"}
        </span>
      </header>

      {/* Winner */}
      {state.winner && (
        <div className="winner-banner">
          <span className="winner-banner-label">Winner</span>
          <span className="winner-banner-name">{state.winner}</span>
        </div>
      )}

      {/* Main content — fills remaining viewport height */}
      <div className="game-content">

      {/* Main grid */}
      <section className="game-grid">
        <TreatiesPanel treaties={state.treaties} offers={state.pending_treaty_offers} />
        <MapSvg territories={state.territories} playerColors={playerColors} />
        <PlayerTable
          players={state.players}
          currentPlayerId={state.current_player}
          actorId={actor}
        />
      </section>

      {/* Resizable lower section */}
      <div className="lower-section" style={{ height: lowerHeight }}>

        {/* Drag handle */}
        <div
          className="lower-resize-handle"
          onMouseDown={(e) => {
            e.preventDefault();
            lowerDragRef.current = { startY: e.clientY, startH: lowerHeight };
            const onMove = (ev: MouseEvent) => {
              if (!lowerDragRef.current) return;
              const delta = lowerDragRef.current.startY - ev.clientY;
              setLowerHeight(Math.min(640, Math.max(80, lowerDragRef.current.startH + delta)));
            };
            const onUp = () => {
              lowerDragRef.current = null;
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        >
          <span className="lower-resize-pill" />
        </div>

        {/* Original three-panel grid */}
        <div className="lower-grid">
          <ChatPanel
            messages={state.chat}
            players={state.players}
            onSend={async (payload) => {
              await submitBundle({ phase_actions: [], chat: [payload] });
            }}
          />

          <ActionLog events={state.log} />

          <section className="panel controls-panel">
            <span className="panel-title">Your Actions</span>

            {humanPlayers.length === 0 && (
              <p className="spectator-note">Spectator mode — no human players.</p>
            )}

            {humanPlayers.length > 0 && (
              <div className="controls-scroll">
                {humanPlayers.length > 1 && (
                  <label className="actor-select-label">
                    Playing as
                    <select value={actor} onChange={(e) => setActor(e.target.value)}>
                      {humanPlayers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                {!isActiveHumanTurn ? (
                  <div className="waiting-turn">
                    <span className="waiting-turn-icon">⏳</span>
                    <span className="waiting-turn-text">
                      Waiting for{" "}
                      <strong style={{ color: currentPlayerInfo?.color }}>
                        {currentPlayerInfo?.name ?? state.current_player ?? "…"}
                      </strong>
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="phase-stepper">
                      {PHASES.map((p, i) => (
                        <div key={p} className={["phase-step", i === phaseIndex ? "is-active" : "", i < phaseIndex ? "is-done" : ""].filter(Boolean).join(" ")}>
                          <div className="phase-step-num">{i < phaseIndex ? "✓" : i + 1}</div>
                          <div className="phase-step-label">{PHASE_LABELS[p]}</div>
                        </div>
                      ))}
                    </div>

                    {state.phase === "reinforce" && (
                      <div className="phase-panel">
                        <p className="phase-hint">Place <strong>{humanPlayers.find(p => p.id === actor)?.armies_in_hand ?? 0}</strong> armies on your territories.</p>
                        <div className="phase-form">
                          <select value={reinforceTarget} onChange={(e) => setReinforceTarget(e.target.value)}>
                            <option value="">— territory —</option>
                            {ownedTerritories.map((id) => <option key={id} value={id}>{id.replace(/_/g, " ")}</option>)}
                          </select>
                          <input type="number" min={1} value={reinforceUnits} onChange={(e) => setReinforceUnits(Number(e.target.value))} />
                          <button className="btn-primary" disabled={!reinforceTarget}
                            onClick={() => submitBundle({ phase_actions: [{ type: "reinforce", territory: reinforceTarget, units: reinforceUnits }], chat: [] })}>
                            Place Armies
                          </button>
                        </div>
                        <button className="btn-end-phase" onClick={endPhase}>Done Reinforcing →</button>
                      </div>
                    )}

                    {state.phase === "attack" && (
                      <div className="phase-panel">
                        <p className="phase-hint">Attack enemy territories. You can attack multiple times or skip.</p>
                        <div className="phase-form">
                          <select value={attackFrom} onChange={(e) => { setAttackFrom(e.target.value); setAttackTo(""); }}>
                            <option value="">— from —</option>
                            {attackFromTerritories.map((id) => <option key={id} value={id}>{id.replace(/_/g, " ")} ({state.territories[id]?.armies})</option>)}
                          </select>
                          <select value={attackTo} onChange={(e) => setAttackTo(e.target.value)} disabled={!attackFrom}>
                            <option value="">— to —</option>
                            {attackToTerritories.map((id) => <option key={id} value={id}>{id.replace(/_/g, " ")} ({state.territories[id]?.armies})</option>)}
                          </select>
                          <label className="dice-label">
                            Dice
                            <input type="number" min={1} max={3} value={attackDice} onChange={(e) => setAttackDice(Number(e.target.value))} />
                          </label>
                          <button className="btn-primary btn-attack" disabled={!attackFrom || !attackTo}
                            onClick={() => submitBundle({ phase_actions: [{ type: "attack", from_territory: attackFrom, to_territory: attackTo, dice: attackDice }], chat: [] })}>
                            Attack
                          </button>
                        </div>
                        <button className="btn-end-phase" onClick={endPhase}>End Attack →</button>
                      </div>
                    )}

                    {state.phase === "fortify" && (
                      <div className="phase-panel">
                        <p className="phase-hint">Move armies between two connected territories you own.</p>
                        <div className="phase-form">
                          <select value={fortifyFrom} onChange={(e) => { setFortifyFrom(e.target.value); setFortifyTo(""); }}>
                            <option value="">— from —</option>
                            {fortifyFromTerritories.map((id) => <option key={id} value={id}>{id.replace(/_/g, " ")} ({state.territories[id]?.armies})</option>)}
                          </select>
                          <select value={fortifyTo} onChange={(e) => setFortifyTo(e.target.value)} disabled={!fortifyFrom}>
                            <option value="">— to —</option>
                            {fortifyToTerritories.map((id) => <option key={id} value={id}>{id.replace(/_/g, " ")} ({state.territories[id]?.armies})</option>)}
                          </select>
                          <input type="number" min={1} value={fortifyUnits} onChange={(e) => setFortifyUnits(Number(e.target.value))} />
                          <button className="btn-primary" disabled={!fortifyFrom || !fortifyTo}
                            onClick={() => submitBundle({ phase_actions: [{ type: "fortify", from_territory: fortifyFrom, to_territory: fortifyTo, units: fortifyUnits }], chat: [] })}>
                            Move Armies
                          </button>
                        </div>
                        <button className="btn-end-phase" onClick={endPhase}>End Turn →</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      </div>{/* end game-content */}

      {error && <p className="error-msg">{error}</p>}
    </main>
  );
}
