import type { GameEvent } from "../api/types";

interface LogProps {
  events: GameEvent[];
}

export function ActionLog({ events }: LogProps) {
  const rows = events.slice(-80).reverse();
  return (
    <section className="panel action-log">
      <span className="panel-title">Action Log</span>
      <div className="action-log-scroll">
        {rows.map((event) => (
          <div key={event.id} className="log-row">
            <span className="log-type">{event.type}</span>
            <span className="log-data">{JSON.stringify(event.data)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
