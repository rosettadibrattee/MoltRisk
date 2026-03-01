import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { addAgent, addHuman, createGame, getGame, startGame } from "../api/client";
import type { AgentCreateInput, GameState } from "../api/types";

const defaultPersonality = {
  aggression: 0.5,
  deception: 0.5,
  cooperation: 0.5,
  risk: 0.5,
};

export function HomePage() {
  const navigate = useNavigate();
  const [game, setGame] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [agent, setAgent] = useState<AgentCreateInput>({
    name: "Agent 1",
    provider: "heuristic",
    model: "llama3.1:8b",
    endpoint: "http://ollama:11434",
    api_key: "",
    personality: defaultPersonality,
    tier: "normal",
  });

  const [humanName, setHumanName] = useState("Human");

  const canStart = useMemo(() => !!game && game.players.length >= 2, [game]);

  const refreshGame = async (state: GameState) => {
    setGame(state);
  };

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const created = await createGame();
      await refreshGame(created);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const onAddAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!game) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addAgent(game.game_id, {
        ...agent,
        api_key: agent.api_key || null,
      });
      const updated = await getGame(game.game_id);
      setGame(updated);
      setAgent((prev) => ({
        ...prev,
        name: `Agent ${updated.players.length + 1}`,
      }));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const onAddHuman = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!game) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addHuman(game.game_id, humanName);
      const updated = await getGame(game.game_id);
      setGame(updated);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    if (!game) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await startGame(game.game_id);
      navigate(`/games/${game.game_id}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home-page">
      <header className="hero">
        <h1>MoltRisk</h1>
        <p>Local AI Agent Risk Game</p>
      </header>

      {!game && (
        <section className="panel">
          <h3>Create Game</h3>
          <button disabled={busy} onClick={create}>
            Create Classic Game
          </button>
        </section>
      )}

      {game && (
        <>
          <section className="panel">
            <h3>Lobby</h3>
            <p>Game ID: {game.game_id}</p>
            <p>Players: {game.players.length}/8</p>
          </section>

          <section className="grid-two">
            <form className="panel" onSubmit={onAddAgent}>
              <h3>Add Agent</h3>
              <input value={agent.name} onChange={(e) => setAgent((s) => ({ ...s, name: e.target.value }))} placeholder="Name" />
              <select
                value={agent.provider}
                onChange={(e) => setAgent((s) => ({ ...s, provider: e.target.value as AgentCreateInput["provider"] }))}
              >
                <option value="heuristic">heuristic</option>
                <option value="ollama">ollama</option>
                <option value="openai_compat">openai_compat</option>
              </select>
              <input value={agent.model} onChange={(e) => setAgent((s) => ({ ...s, model: e.target.value }))} placeholder="Model" />
              <input
                value={agent.endpoint}
                onChange={(e) => setAgent((s) => ({ ...s, endpoint: e.target.value }))}
                placeholder="Endpoint"
              />
              <input
                type="password"
                value={agent.api_key ?? ""}
                onChange={(e) => setAgent((s) => ({ ...s, api_key: e.target.value }))}
                placeholder="API key (optional)"
              />
              <select value={agent.tier} onChange={(e) => setAgent((s) => ({ ...s, tier: e.target.value as AgentCreateInput["tier"] }))}>
                <option value="easy">easy</option>
                <option value="normal">normal</option>
                <option value="hard">hard</option>
              </select>
              {(["aggression", "deception", "cooperation", "risk"] as const).map((key) => (
                <label key={key}>
                  {key}: {agent.personality[key].toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={agent.personality[key]}
                    onChange={(e) =>
                      setAgent((s) => ({
                        ...s,
                        personality: { ...s.personality, [key]: Number(e.target.value) },
                      }))
                    }
                  />
                </label>
              ))}
              <button disabled={busy || game.players.length >= 8} type="submit">
                Add Agent
              </button>
            </form>

            <form className="panel" onSubmit={onAddHuman}>
              <h3>Add Human</h3>
              <input value={humanName} onChange={(e) => setHumanName(e.target.value)} placeholder="Human name" />
              <button disabled={busy || game.players.length >= 8} type="submit">
                Add Human
              </button>
              <h4>Current Players</h4>
              <ul>
                {game.players.map((player) => (
                  <li key={player.id}>
                    {player.name} ({player.kind})
                  </li>
                ))}
              </ul>
            </form>
          </section>

          <section className="panel">
            <button disabled={!canStart || busy} onClick={onStart}>
              Start Game
            </button>
          </section>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </main>
  );
}
