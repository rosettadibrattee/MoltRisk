import type { GameEvent } from "../api/types";

interface LogProps {
  events: GameEvent[];
}

export function ActionLog({ events }: LogProps) {
  const rows = events.slice(-80).reverse();
  return (
    <section className="panel action-log">
      <h3>Action Log</h3>
      <ul>
        {rows.map((event) => (
          <li key={event.id}>
            <strong>{event.type}</strong> <code>{JSON.stringify(event.data)}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
