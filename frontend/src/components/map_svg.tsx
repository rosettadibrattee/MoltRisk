import { useMemo, useState } from "react";

import type { Player, TerritoryState } from "../api/types";

interface MapProps {
  territories: Record<string, TerritoryState>;
  players: Player[];
}

type TerritoryLayout = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const LAYOUT: TerritoryLayout[] = [
  { id: "alaska", name: "Alaska", x: 20, y: 40, w: 110, h: 70 },
  { id: "northwest_territory", name: "Northwest Territory", x: 140, y: 40, w: 130, h: 70 },
  { id: "greenland", name: "Greenland", x: 280, y: 20, w: 130, h: 80 },
  { id: "alberta", name: "Alberta", x: 90, y: 120, w: 110, h: 65 },
  { id: "ontario", name: "Ontario", x: 210, y: 110, w: 120, h: 70 },
  { id: "quebec", name: "Quebec", x: 340, y: 110, w: 90, h: 70 },
  { id: "western_united_states", name: "Western US", x: 100, y: 190, w: 120, h: 65 },
  { id: "eastern_united_states", name: "Eastern US", x: 230, y: 190, w: 120, h: 65 },
  { id: "central_america", name: "Central America", x: 170, y: 265, w: 110, h: 65 },

  { id: "venezuela", name: "Venezuela", x: 260, y: 340, w: 105, h: 70 },
  { id: "peru", name: "Peru", x: 250, y: 420, w: 100, h: 80 },
  { id: "brazil", name: "Brazil", x: 360, y: 400, w: 120, h: 90 },
  { id: "argentina", name: "Argentina", x: 270, y: 510, w: 110, h: 90 },

  { id: "iceland", name: "Iceland", x: 500, y: 80, w: 90, h: 55 },
  { id: "scandinavia", name: "Scandinavia", x: 600, y: 70, w: 100, h: 70 },
  { id: "ukraine", name: "Ukraine", x: 710, y: 110, w: 130, h: 95 },
  { id: "great_britain", name: "Great Britain", x: 510, y: 150, w: 100, h: 65 },
  { id: "northern_europe", name: "Northern Europe", x: 620, y: 170, w: 110, h: 70 },
  { id: "western_europe", name: "Western Europe", x: 520, y: 230, w: 120, h: 80 },
  { id: "southern_europe", name: "Southern Europe", x: 650, y: 240, w: 120, h: 80 },

  { id: "north_africa", name: "North Africa", x: 520, y: 330, w: 145, h: 80 },
  { id: "egypt", name: "Egypt", x: 675, y: 330, w: 95, h: 70 },
  { id: "east_africa", name: "East Africa", x: 730, y: 410, w: 115, h: 100 },
  { id: "congo", name: "Congo", x: 620, y: 430, w: 100, h: 85 },
  { id: "south_africa", name: "South Africa", x: 620, y: 530, w: 120, h: 90 },
  { id: "madagascar", name: "Madagascar", x: 760, y: 540, w: 80, h: 90 },

  { id: "ural", name: "Ural", x: 860, y: 80, w: 100, h: 90 },
  { id: "siberia", name: "Siberia", x: 970, y: 70, w: 130, h: 100 },
  { id: "yakutsk", name: "Yakutsk", x: 1110, y: 50, w: 100, h: 90 },
  { id: "kamchatka", name: "Kamchatka", x: 1220, y: 70, w: 120, h: 95 },
  { id: "irkutsk", name: "Irkutsk", x: 1090, y: 160, w: 105, h: 85 },
  { id: "mongolia", name: "Mongolia", x: 980, y: 180, w: 120, h: 90 },
  { id: "japan", name: "Japan", x: 1240, y: 190, w: 80, h: 85 },
  { id: "afghanistan", name: "Afghanistan", x: 850, y: 190, w: 115, h: 90 },
  { id: "middle_east", name: "Middle East", x: 820, y: 300, w: 120, h: 90 },
  { id: "india", name: "India", x: 940, y: 290, w: 105, h: 90 },
  { id: "siam", name: "Siam", x: 1045, y: 305, w: 95, h: 85 },
  { id: "china", name: "China", x: 950, y: 220, w: 145, h: 90 },

  { id: "indonesia", name: "Indonesia", x: 1060, y: 420, w: 120, h: 75 },
  { id: "new_guinea", name: "New Guinea", x: 1185, y: 430, w: 120, h: 75 },
  { id: "western_australia", name: "Western Australia", x: 1080, y: 510, w: 120, h: 85 },
  { id: "eastern_australia", name: "Eastern Australia", x: 1210, y: 520, w: 120, h: 85 }
];

export function MapSvg({ territories, players }: MapProps) {
  const [scale, setScale] = useState(0.85);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ label: string; x: number; y: number } | null>(null);

  const colorMap = useMemo(() => {
    const mapping: Record<string, string> = {};
    players.forEach((player) => {
      mapping[player.id] = player.color;
    });
    return mapping;
  }, [players]);

  return (
    <section className="panel map-panel">
      <h3>World Map</h3>
      <div
        className="map-stage"
        onWheel={(event) => {
          event.preventDefault();
          const factor = event.deltaY < 0 ? 1.1 : 0.9;
          setScale((current) => Math.min(2.5, Math.max(0.55, current * factor)));
        }}
        onMouseDown={(event) => setDrag({ x: event.clientX - offset.x, y: event.clientY - offset.y })}
        onMouseMove={(event) => {
          if (drag) {
            setOffset({ x: event.clientX - drag.x, y: event.clientY - drag.y });
          }
        }}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => {
          setDrag(null);
          setHover(null);
        }}
      >
        <svg viewBox="0 0 1380 680" role="img" aria-label="Risk map">
          <g transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>
            {LAYOUT.map((territory) => {
              const state = territories[territory.id];
              const fill = state ? colorMap[state.owner] ?? "#495057" : "#222";
              const label = `${territory.name} • ${state?.owner ?? "-"} • ${state?.armies ?? 0}`;
              return (
                <g key={territory.id}>
                  <rect
                    id={territory.id}
                    x={territory.x}
                    y={territory.y}
                    width={territory.w}
                    height={territory.h}
                    rx={8}
                    fill={fill}
                    stroke="#0f172a"
                    strokeWidth={2}
                    onMouseEnter={(event) =>
                      setHover({
                        label,
                        x: event.clientX,
                        y: event.clientY,
                      })
                    }
                    onMouseMove={(event) => setHover({ label, x: event.clientX, y: event.clientY })}
                  />
                  <text
                    x={territory.x + territory.w / 2}
                    y={territory.y + territory.h / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#f8f9fa"
                    fontSize={11}
                  >
                    {state?.armies ?? 0}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      {hover && (
        <div className="map-tooltip" style={{ left: hover.x + 10, top: hover.y + 10 }}>
          {hover.label}
        </div>
      )}
    </section>
  );
}
