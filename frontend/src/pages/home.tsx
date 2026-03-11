import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addAgent, addHuman, createGame, getGame, startGame } from "../api/client";
import type { AgentCreateInput, GameState } from "../api/types";

const defaultPersonality = { aggression: 0.5, deception: 0.5, cooperation: 0.5, risk: 0.5 };

export function HomePage() {
  const navigate = useNavigate();
  const [game, setGame] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agent, setAgent] = useState<AgentCreateInput>({
    name: "Agent 1", provider: "heuristic", model: "llama3.1:8b",
    endpoint: "http://ollama:11434", api_key: "", personality: defaultPersonality, tier: "normal",
  });
  const [humanName, setHumanName] = useState("Human");
  const canStart = useMemo(() => !!game && game.players.length >= 2, [game]);

  const create = async () => {
    setBusy(true); setError("");
    try { setGame(await createGame()); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const onAddAgent = async (e: React.FormEvent) => {
    e.preventDefault(); if (!game) return;
    setBusy(true); setError("");
    try {
      await addAgent(game.game_id, { ...agent, api_key: agent.api_key || null });
      const u = await getGame(game.game_id);
      setGame(u); setAgent((s) => ({ ...s, name: `Agent ${u.players.length + 1}` }));
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const onAddHuman = async (e: React.FormEvent) => {
    e.preventDefault(); if (!game) return;
    setBusy(true); setError("");
    try { await addHuman(game.game_id, humanName); setGame(await getGame(game.game_id)); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const onStart = async () => {
    if (!game) return;
    setBusy(true); setError("");
    try { await startGame(game.game_id); navigate(`/games/${game.game_id}`); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  return (
    <main className="home-page">
      <div className="home-hero">
        <h1>MoltRisk</h1>
        <p>AI Agent Strategy Warfare</p>
      </div>
      {!game && (
        <div className="panel" style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ color: "var(--text-dim)", marginBottom: "1rem" }}>
            Deploy autonomous AI agents onto the classic Risk board. Watch them negotiate, deceive, and wage war.
          </p>
          <button className="btn-primary" disabled={busy} onClick={create}>Create New Game</button>
        </div>
      )}
      {game && (<>
        <div className="panel">
          <div className="lobby-info">
            <div><h3>Lobby</h3><span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>ID: {game.game_id}</span></div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "var(--accent)" }}>{game.players.length} / 8</div>
          </div>
        </div>
        <div className="lobby-grid">
          <form className="panel" onSubmit={onAddAgent}>
            <h3>Add Agent</h3>
            <label>Name<input value={agent.name} onChange={(e) => setAgent((s) => ({ ...s, name: e.target.value }))} /></label>
            <label>Provider
              <select value={agent.provider} onChange={(e) => setAgent((s) => ({ ...s, provider: e.target.value as AgentCreateInput["provider"] }))}>
                <option value="heuristic">Heuristic (built-in)</option>
                <option value="ollama">Ollama (local LLM)</option>
                <option value="openai_compat">OpenAI-Compatible</option>
              </select>
            </label>
            {agent.provider !== "heuristic" && (<>
              <label>Model<input value={agent.model} onChange={(e) => setAgent((s) => ({ ...s, model: e.target.value }))} /></label>
              <label>Endpoint<input value={agent.endpoint} onChange={(e) => setAgent((s) => ({ ...s, endpoint: e.target.value }))} /></label>
              <label>API Key<input type="password" value={agent.api_key ?? ""} onChange={(e) => setAgent((s) => ({ ...s, api_key: e.target.value }))} placeholder="optional" /></label>
            </>)}
            <label>Tier
              <select value={agent.tier} onChange={(e) => setAgent((s) => ({ ...s, tier: e.target.value as AgentCreateInput["tier"] }))}>
                <option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option>
              </select>
            </label>
            {(["aggression", "deception", "cooperation", "risk"] as const).map((k) => (
              <label key={k}><div className="slider-row">
                <span style={{ flex: 1, textTransform: "capitalize" }}>{k}</span>
                <input type="range" min={0} max={1} step={0.05} value={agent.personality[k]} style={{ flex: 2 }}
                  onChange={(e) => setAgent((s) => ({ ...s, personality: { ...s.personality, [k]: Number(e.target.value) } }))} />
                <span>{agent.personality[k].toFixed(2)}</span>
              </div></label>
            ))}
            <button disabled={busy || game.players.length >= 8} type="submit">Add Agent</button>
          </form>
          <div className="panel">
            <form onSubmit={onAddHuman} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <h3>Add Human</h3>
              <label>Name<input value={humanName} onChange={(e) => setHumanName(e.target.value)} /></label>
              <button disabled={busy || game.players.length >= 8} type="submit">Add Human</button>
            </form>
            <h4 style={{ marginTop: "1.2rem" }}>Roster</h4>
            {game.players.length === 0 && <div className="empty-state">No players yet</div>}
            <ul className="player-roster">
              {game.players.map((p) => (
                <li key={p.id}><div className="dot" style={{ background: p.color }} />{p.name}<span className="kind">{p.kind}</span></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="start-section panel">
          <button className="btn-primary" disabled={!canStart || busy} onClick={onStart}>
            {canStart ? "Launch Game" : "Need at least 2 players"}
          </button>
        </div>
      </>)}
      {error && <div className="error-bar">{error}</div>}
    </main>
  );
}
