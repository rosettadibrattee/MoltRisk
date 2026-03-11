import { useRef, useEffect } from "react";
import type { GameEvent } from "../api/types";

interface Props { events: GameEvent[]; }

function fmtData(data: Record<string, unknown>): string {
  const parts: string[] = [];
  if (data.player) parts.push(String(data.player));
  if (data.territory) parts.push(String(data.territory));
  if (data.units) parts.push(`${data.units} units`);
  if (data.from) parts.push(`${data.from} → ${data.to ?? ""}`);
  if (data.conquered) parts.push("CONQUERED");
  if (data.winner) parts.push(`Winner: ${data.winner}`);
  if (data.message) parts.push(String(data.message));
  if (data.error) parts.push(String(data.error).slice(0, 60));
  if (data.phase) parts.push(String(data.phase));
  if (parts.length === 0) return JSON.stringify(data).slice(0, 80);
  return parts.join(" · ");
}

export function ActionLog({ events }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [events.length]);

  const rows = events.slice(-60);
  return (
    <div>
      <h3>Action Log</h3>
      <div className="log-stream" style={{ marginTop: "0.4rem" }}>
        {rows.map((e) => (
          <div key={e.id} className="log-entry">
            <span className="log-type">{e.type}</span>
            <span className="log-data">{fmtData(e.data)}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
