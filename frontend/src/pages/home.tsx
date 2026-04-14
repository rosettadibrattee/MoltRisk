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

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      setGame(await createGame());
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const onAddAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!game) return;
    setBusy(true);
    setError("");
    try {
      await addAgent(game.game_id, { ...agent, api_key: agent.api_key || null });
      const updated = await getGame(game.game_id);
      setGame(updated);
      setAgent((prev) => ({ ...prev, name: `Agent ${updated.players.length + 1}` }));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const onAddHuman = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!game) return;
    setBusy(true);
    setError("");
    try {
      await addHuman(game.game_id, humanName);
      setGame(await getGame(game.game_id));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    if (!game) return;
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
      {/* App bar */}
      <header className="home-app-bar">
        <div>
          <div className="home-wordmark">MoltRisk</div>
          {!game && <div className="home-tagline">Local AI Agent Risk Game</div>}
        </div>
        {game && (
          <span className="chip chip--primary">
            {game.game_id.slice(0, 14)}…
          </span>
        )}
      </header>

      {/* No game: big CTA */}
      {!game && (
        <div className="home-create-section">
          <button className="home-create-cta" disabled={busy} onClick={create}>
            New Game
          </button>
        </div>
      )}

      {/* Lobby */}
      {game && (
        <div className="home-lobby">
          {/* Players */}
          <section className="panel">
            <div className="home-players-header">
              <span className="panel-title">Players</span>
              <span className="chip">{game.players.length} / 8</span>
              {canStart && (
                <span className="chip chip--success chip--dot">Ready</span>
              )}
            </div>
            <div className="home-players-chips">
              {game.players.length === 0 && (
                <span style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
                  No players yet
                </span>
              )}
              {game.players.map((player) => (
                <span
                  key={player.id}
                  className="chip"
                  style={{ borderColor: player.color, color: player.color }}
                >
                  {player.name} · {player.kind}
                </span>
              ))}
            </div>
          </section>

          {/* Add forms */}
          <div className="home-add-forms">
            <section className="panel">
              <form className="home-form" onSubmit={onAddAgent}>
                <span className="home-form-title">Add Agent</span>

                <label>
                  Name
                  <input
                    value={agent.name}
                    onChange={(e) => setAgent((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Agent name"
                  />
                </label>

                <label>
                  Provider
                  <select
                    value={agent.provider}
                    onChange={(e) =>
                      setAgent((s) => ({ ...s, provider: e.target.value as AgentCreateInput["provider"] }))
                    }
                  >
                    <option value="heuristic">Heuristic</option>
                    <option value="ollama">Ollama</option>
                    <option value="openai_compat">OpenAI Compat</option>
                  </select>
                </label>

                <label>
                  Model
                  <input
                    value={agent.model}
                    onChange={(e) => setAgent((s) => ({ ...s, model: e.target.value }))}
                    placeholder="e.g. llama3.1:8b"
                  />
                </label>

                <label>
                  Endpoint
                  <input
                    value={agent.endpoint}
                    onChange={(e) => setAgent((s) => ({ ...s, endpoint: e.target.value }))}
                    placeholder="http://..."
                  />
                </label>

                <label>
                  API Key
                  <input
                    type="password"
                    value={agent.api_key ?? ""}
                    onChange={(e) => setAgent((s) => ({ ...s, api_key: e.target.value }))}
                    placeholder="Optional"
                  />
                </label>

                <label>
                  Tier
                  <select
                    value={agent.tier}
                    onChange={(e) =>
                      setAgent((s) => ({ ...s, tier: e.target.value as AgentCreateInput["tier"] }))
                    }
                  >
                    <option value="easy">Easy</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>

                <div className="personality-grid">
                  {(["aggression", "deception", "cooperation", "risk"] as const).map((key) => (
                    <div className="personality-row" key={key}>
                      <span>
                        {key[0].toUpperCase() + key.slice(1)}{" "}
                        <strong style={{ color: "var(--on-surf)" }}>
                          {agent.personality[key].toFixed(2)}
                        </strong>
                      </span>
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
                    </div>
                  ))}
                </div>

                <button
                  className="btn-tonal"
                  disabled={busy || game.players.length >= 8}
                  type="submit"
                >
                  Add Agent
                </button>
              </form>
            </section>

            <section className="panel">
              <form className="home-form" onSubmit={onAddHuman}>
                <span className="home-form-title">Add Human</span>

                <label>
                  Name
                  <input
                    value={humanName}
                    onChange={(e) => setHumanName(e.target.value)}
                    placeholder="Player name"
                  />
                </label>

                <button
                  className="btn-tonal"
                  disabled={busy || game.players.length >= 8}
                  type="submit"
                >
                  Add Human
                </button>
              </form>
            </section>
          </div>

          {/* Start */}
          <div className="home-start-bar">
            <button
              className="home-start-btn"
              disabled={!canStart || busy}
              onClick={onStart}
            >
              Start Game
            </button>
          </div>
        </div>
      )}

      {error && <p className="error-msg">{error}</p>}
    </main>
  );
}
