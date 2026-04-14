import type { Treaty, TreatyOffer } from "../api/types";

interface TreatiesProps {
  treaties: Treaty[];
  offers: TreatyOffer[];
}

export function TreatiesPanel({ treaties, offers }: TreatiesProps) {
  return (
    <section className="panel">
      <span className="panel-title">Treaties</span>

      <div className="treaties-section">
        <div className="treaties-section-title">Active</div>
        <div className="treaties-list">
          {treaties.length === 0 && (
            <span className="treaties-empty">None</span>
          )}
          {treaties.map((t) => (
            <div key={t.id} className="treaty-row">
              <span className="treaty-type">{t.type.replace("_", " ")}</span>
              <span className="treaty-players">{t.players.join(" ↔ ")}</span>
              <span className="treaty-expires">T{t.expires_turn}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="treaties-section" style={{ marginTop: "0.75rem" }}>
        <div className="treaties-section-title">Pending Offers</div>
        <div className="treaties-list">
          {offers.length === 0 && (
            <span className="treaties-empty">None</span>
          )}
          {offers.map((o) => (
            <div key={o.id} className="treaty-row">
              <span className="treaty-type">{o.type.replace("_", " ")}</span>
              <span className="treaty-players">
                {o.from_player} → {o.to_player}
              </span>
              <span className="treaty-expires">{o.duration_turns}T</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
