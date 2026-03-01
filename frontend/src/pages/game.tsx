import { useEffect, useMemo, useState } from "react";
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

  const [actor, setActor] = useState("");
  const [reinforceTarget, setReinforceTarget] = useState("");
  const [reinforceUnits, setReinforceUnits] = useState(1);
  const [attackFrom, setAttackFrom] = useState("");
  const [attackTo, setAttackTo] = useState("");
  const [attackDice, setAttackDice] = useState(1);
  const [fortifyFrom, setFortifyFrom] = useState("");
  const [fortifyTo, setFortifyTo] = useState("");
  const [fortifyUnits, setFortifyUnits] = useState(1);

  useEffect(() => {
    if (!gameId) {
      return;
    }
    let cleanup = () => {};
    getGame(gameId)
      .then((game) => {
        setState(game);
        const firstHuman = game.players.find((player) => player.kind === "human")?.id ?? "";
        setActor(firstHuman);
      })
      .catch((err) => setError(String(err)));

    cleanup = connectGameWs(gameId, {
      onMessage: (envelope) => {
        if (envelope.type === "state") {
          setState(envelope.payload as GameState);
        }
      },
      onState: setConnected,
    });

    return cleanup;
  }, [gameId]);

  const humanPlayers = useMemo(() => state.players.filter((player) => player.kind === "human"), [state.players]);
  const isActiveHumanTurn = !!actor && state.current_player === actor && state.status === "running";

  useEffect(() => {
    if (!actor && humanPlayers[0]) {
      setActor(humanPlayers[0].id);
    }
  }, [actor, humanPlayers]);

  const territoryIds = Object.keys(state.territories);

  const submitBundle = async (bundle: Record<string, unknown>) => {
    if (!gameId || !actor) {
      return;
    }
    try {
      const response = await submitAction(gameId, actor, bundle);
      if (!response.accepted && response.errors.length) {
        setError(response.errors.join(" | "));
      } else {
        setError("");
      }
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <main className="game-page">
      <header className="turn-bar panel">
        <div>
          <strong>Game:</strong> {state.game_id}
        </div>
        <div>
          <strong>Turn:</strong> {state.turn}
        </div>
        <div>
          <strong>Current:</strong> {state.current_player ?? "-"}
        </div>
        <div>
          <strong>Phase:</strong> {state.phase}
        </div>
        <div>
          <strong>Timer:</strong> <Timer deadlineTs={state.turn_deadline_ts} />
        </div>
        <div>
          <strong>WS:</strong> {connected ? "connected" : "reconnecting"}
        </div>
      </header>

      {state.winner && (
        <section className="panel winner-banner">
          Winner: <strong>{state.winner}</strong>
        </section>
      )}

      <section className="game-grid">
        <TreatiesPanel treaties={state.treaties} offers={state.pending_treaty_offers} />

        <MapSvg territories={state.territories} players={state.players} />

        <PlayerTable players={state.players} currentPlayerId={state.current_player} />
      </section>

      <section className="lower-grid">
        <ChatPanel
          messages={state.chat}
          players={state.players}
          onSend={async (payload) => {
            if (!actor) {
              return;
            }
            await submitBundle({ phase_actions: [], chat: [payload] });
          }}
        />

        <ActionLog events={state.log} />

        <section className="panel controls">
          <h3>Human Actions</h3>
          {humanPlayers.length === 0 && <p>Spectator mode: no human players in this match.</p>}
          {humanPlayers.length > 0 && (
            <>
              <label>
                Acting player
                <select value={actor} onChange={(event) => setActor(event.target.value)}>
                  {humanPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.id})
                    </option>
                  ))}
                </select>
              </label>
              {!isActiveHumanTurn && <p>Spectator mode: selected human is not the active turn player.</p>}

              <div className="control-block">
                <h4>Reinforce</h4>
                <select value={reinforceTarget} onChange={(event) => setReinforceTarget(event.target.value)}>
                  <option value="">-- territory --</option>
                  {territoryIds.map((territoryId) => (
                    <option key={territoryId} value={territoryId}>
                      {territoryId}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={reinforceUnits}
                  onChange={(event) => setReinforceUnits(Number(event.target.value))}
                />
                <button
                  disabled={!isActiveHumanTurn}
                  onClick={() =>
                    submitBundle({
                      phase_actions: [{ type: "reinforce", territory: reinforceTarget, units: reinforceUnits }],
                      chat: [],
                    })
                  }
                >
                  Submit Reinforce
                </button>
              </div>

              <div className="control-block">
                <h4>Attack</h4>
                <select value={attackFrom} onChange={(event) => setAttackFrom(event.target.value)}>
                  <option value="">-- from --</option>
                  {territoryIds.map((territoryId) => (
                    <option key={territoryId} value={territoryId}>
                      {territoryId}
                    </option>
                  ))}
                </select>
                <select value={attackTo} onChange={(event) => setAttackTo(event.target.value)}>
                  <option value="">-- to --</option>
                  {territoryIds.map((territoryId) => (
                    <option key={territoryId} value={territoryId}>
                      {territoryId}
                    </option>
                  ))}
                </select>
                <input type="number" min={1} max={3} value={attackDice} onChange={(event) => setAttackDice(Number(event.target.value))} />
                <button
                  disabled={!isActiveHumanTurn}
                  onClick={() =>
                    submitBundle({
                      phase_actions: [{ type: "attack", from_territory: attackFrom, to_territory: attackTo, dice: attackDice }],
                      chat: [],
                    })
                  }
                >
                  Submit Attack
                </button>
              </div>

              <div className="control-block">
                <h4>Fortify</h4>
                <select value={fortifyFrom} onChange={(event) => setFortifyFrom(event.target.value)}>
                  <option value="">-- from --</option>
                  {territoryIds.map((territoryId) => (
                    <option key={territoryId} value={territoryId}>
                      {territoryId}
                    </option>
                  ))}
                </select>
                <select value={fortifyTo} onChange={(event) => setFortifyTo(event.target.value)}>
                  <option value="">-- to --</option>
                  {territoryIds.map((territoryId) => (
                    <option key={territoryId} value={territoryId}>
                      {territoryId}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={fortifyUnits}
                  onChange={(event) => setFortifyUnits(Number(event.target.value))}
                />
                <button
                  disabled={!isActiveHumanTurn}
                  onClick={() =>
                    submitBundle({
                      phase_actions: [
                        {
                          type: "fortify",
                          from_territory: fortifyFrom,
                          to_territory: fortifyTo,
                          units: fortifyUnits,
                        },
                      ],
                      chat: [],
                    })
                  }
                >
                  Submit Fortify
                </button>
              </div>
            </>
          )}
        </section>
      </section>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
