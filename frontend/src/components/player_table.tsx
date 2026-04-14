import type { Player } from "../api/types";

interface PlayerTableProps {
  players: Player[];
  currentPlayerId: string | null;
  actorId?: string;
}

export function PlayerTable({ players, currentPlayerId, actorId }: PlayerTableProps) {
  return (
    <section className="panel player-table">
      <span className="panel-title">Players</span>
      <div className="player-table-scroll">
        {players.map((player) => (
          <article
            key={player.id}
            className={[
              "player-card",
              player.id === currentPlayerId ? "is-current" : "",
              player.alive ? "" : "is-out",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ borderLeftColor: player.color }}
          >
            {player.id === currentPlayerId && (
              <span className="player-card-turn-arrow" title="Active player">▶</span>
            )}
            <div className="player-card-header">
              <span className="player-card-name">{player.name}</span>
              <span className="player-card-kind">{player.kind}</span>
            </div>
            <p className="player-card-stat">Armies: {player.armies_in_hand}</p>
            <p className="player-card-stat">
              Cards: {player.cards.length ? player.cards.join(", ") : "none"}
            </p>
            <p className="player-card-stat">Mission: {formatMission(player.mission)}</p>
            <p className="player-card-stat">
              Rep: {player.reputation.toFixed(2)} · {player.tier}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatMission(mission: Player["mission"]): string {
  if (mission.type === "destroy_player") return `Destroy ${mission.target_player ?? "target"}`;
  if (mission.type === "control_continents")
    return `Control ${mission.continents?.join(" + ") ?? "continents"}`;
  if (mission.type === "control_18_two_armies") return "18 territories (2+ armies)";
  return "24 territories";
}
