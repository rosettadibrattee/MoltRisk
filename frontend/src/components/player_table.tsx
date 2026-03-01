import type { Player } from "../api/types";

interface PlayerTableProps {
  players: Player[];
  currentPlayerId: string | null;
}

export function PlayerTable({ players, currentPlayerId }: PlayerTableProps) {
  return (
    <section className="panel player-table">
      <h3>Player Table</h3>
      <div className="player-table-grid">
        {players.map((player) => (
          <article
            key={player.id}
            className={`player-card ${player.id === currentPlayerId ? "is-current" : ""} ${player.alive ? "" : "is-out"}`}
            style={{ borderColor: player.color }}
          >
            <header>
              <strong>{player.name}</strong>
              <span>{player.kind}</span>
            </header>
            <p>Armies in hand: {player.armies_in_hand}</p>
            <p>Cards: {player.cards.length ? player.cards.join(", ") : "none"}</p>
            <p>Mission: {formatMission(player.mission)}</p>
            <p>Reputation: {player.reputation.toFixed(2)}</p>
            <p>Tier: {player.tier}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatMission(mission: Player["mission"]): string {
  if (mission.type === "destroy_player") {
    return `Destroy ${mission.target_player ?? "target"}`;
  }
  if (mission.type === "control_continents") {
    return `Control ${mission.continents?.join(" + ") ?? "continents"}`;
  }
  if (mission.type === "control_18_two_armies") {
    return "Control 18 territories with 2+ armies";
  }
  return "Control 24 territories";
}
