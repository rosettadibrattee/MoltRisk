import type { Treaty, TreatyOffer } from "../api/types";

interface TreatiesProps {
  treaties: Treaty[];
  offers: TreatyOffer[];
}

export function TreatiesPanel({ treaties, offers }: TreatiesProps) {
  return (
    <section className="panel treaties-panel">
      <h3>Treaties</h3>
      <h4>Active</h4>
      <ul>
        {treaties.length === 0 && <li>No active treaties</li>}
        {treaties.map((treaty) => (
          <li key={treaty.id}>
            <strong>{treaty.type}</strong> {treaty.players.join(" ↔ ")} (expires turn {treaty.expires_turn})
          </li>
        ))}
      </ul>
      <h4>Pending Offers</h4>
      <ul>
        {offers.length === 0 && <li>No pending offers</li>}
        {offers.map((offer) => (
          <li key={offer.id}>
            <strong>{offer.type}</strong> {offer.from_player} → {offer.to_player} ({offer.duration_turns} turns)
          </li>
        ))}
      </ul>
    </section>
  );
}
