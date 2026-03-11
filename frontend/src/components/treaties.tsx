import type { Treaty, TreatyOffer } from "../api/types";

interface Props { treaties: Treaty[]; offers: TreatyOffer[]; }

export function TreatiesPanel({ treaties, offers }: Props) {
  return (
    <div className="panel">
      <h3>Treaties</h3>
      <h4>Active</h4>
      {treaties.length === 0 && <div className="empty-state">No active treaties</div>}
      {treaties.map((t) => (
        <div key={t.id} className="treaty-item">
          <span className={`treaty-type ${t.type === "non_aggression" ? "nap" : "trade"}`}>
            {t.type === "non_aggression" ? "NAP" : "Trade"}
          </span>
          <div style={{ fontSize: "0.8rem" }}>{t.players.join(" ↔ ")}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>expires turn {t.expires_turn}</div>
        </div>
      ))}
      <h4>Pending Offers</h4>
      {offers.length === 0 && <div className="empty-state">No pending offers</div>}
      {offers.map((o) => (
        <div key={o.id} className="treaty-item">
          <span className={`treaty-type ${o.type === "non_aggression" ? "nap" : "trade"}`}>
            {o.type === "non_aggression" ? "NAP" : "Trade"}
          </span>
          <div style={{ fontSize: "0.8rem" }}>{o.from_player} → {o.to_player}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{o.duration_turns} turns</div>
        </div>
      ))}
    </div>
  );
}
