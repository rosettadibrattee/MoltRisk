import type { Player } from "../api/types";

interface Props {
  players: Player[];
  currentPlayerId: string | null;
}

function fmtMission(m: Player["mission"]): string {
  if (m.type === "destroy_player") return `Destroy ${m.target_player ?? "?"}`;
  if (m.type === "control_continents") return `Hold ${m.continents?.join(" + ") ?? "?"}`;
  if (m.type === "control_18_two_armies") return "18 territories (2+ armies)";
  return "Control 24 territories";
}

export function PlayerTable({ players, currentPlayerId }: Props) {
  return (
    <div className="panel">
      <h3>Players</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: "0.5rem" }}>
        {players.map((p) => (
          <div key={p.id}
            className={`player-card ${p.id === currentPlayerId ? "current" : ""} ${!p.alive ? "eliminated" : ""}`}
            style={{ borderLeftColor: p.color }}>
            <div className="pc-header">
              <div className="pc-color" style={{ background: p.color }} />
              <span className="pc-name">{p.name}</span>
              <span className="pc-kind">{p.kind}</span>
            </div>
            <div className="pc-stats">
              <span>Armies: <span>{p.armies_in_hand}</span></span>
              <span>Cards: <span>{p.cards.length}</span></span>
              <span>Rep: <span>{p.reputation.toFixed(1)}</span></span>
              <span>Tier: <span>{p.tier}</span></span>
            </div>
            <div className="pc-mission">{fmtMission(p.mission)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
