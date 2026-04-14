import { useEffect, useRef, useState } from "react";

import riskBoardSvg from "../assets/risk_board.svg?raw";
import type { TerritoryState } from "../api/types";

const SVG_TO_GAME: Record<string, string> = { yakursk: "yakutsk" };
const GAME_TO_SVG: Record<string, string> = { yakutsk: "yakursk" };

const TERRITORY_IDS = [
  "alaska", "northwest_territory", "greenland", "alberta", "ontario", "quebec",
  "western_united_states", "eastern_united_states", "central_america",
  "venezuela", "peru", "brazil", "argentina",
  "iceland", "scandinavia", "ukraine", "great_britain", "northern_europe",
  "western_europe", "southern_europe",
  "north_africa", "egypt", "east_africa", "congo", "south_africa", "madagascar",
  "ural", "siberia", "yakutsk", "kamchatka", "irkutsk", "mongolia", "japan",
  "afghanistan", "middle_east", "india", "siam", "china",
  "indonesia", "new_guinea", "western_australia", "eastern_australia",
];

// Cross-sea connections that aren't obvious from contiguous borders
const SEA_ROUTES: [string, string][] = [
  ["alaska",           "kamchatka"],
  ["greenland",        "iceland"],
  ["brazil",           "north_africa"],
  ["western_europe",   "north_africa"],
  ["southern_europe",  "north_africa"],
  ["southern_europe",  "egypt"],
  ["east_africa",      "middle_east"],
  ["kamchatka",        "japan"],
  ["siam",             "indonesia"],
  ["madagascar",       "east_africa"],
  ["south_africa",     "madagascar"],
];

const CONTINENT_COLORS: Record<string, string> = {
  alaska: "#F4A261", northwest_territory: "#F4A261", greenland: "#F4A261",
  alberta: "#F4A261", ontario: "#F4A261", quebec: "#F4A261",
  western_united_states: "#F4A261", eastern_united_states: "#F4A261", central_america: "#F4A261",
  venezuela: "#E76F51", peru: "#E76F51", brazil: "#E76F51", argentina: "#E76F51",
  iceland: "#A8DADC", scandinavia: "#A8DADC", ukraine: "#A8DADC",
  great_britain: "#A8DADC", northern_europe: "#A8DADC",
  western_europe: "#A8DADC", southern_europe: "#A8DADC",
  north_africa: "#E9C46A", egypt: "#E9C46A", east_africa: "#E9C46A",
  congo: "#E9C46A", south_africa: "#E9C46A", madagascar: "#E9C46A",
  ural: "#8ECAE6", siberia: "#8ECAE6", yakutsk: "#8ECAE6", kamchatka: "#8ECAE6",
  irkutsk: "#8ECAE6", mongolia: "#8ECAE6", japan: "#8ECAE6",
  afghanistan: "#8ECAE6", middle_east: "#8ECAE6", india: "#8ECAE6",
  siam: "#8ECAE6", china: "#8ECAE6",
  indonesia: "#B5E48C", new_guinea: "#B5E48C",
  western_australia: "#B5E48C", eastern_australia: "#B5E48C",
};

const LAYER4_TX = -167.99651;
const LAYER4_TY = -118.55507;
// SVG natural width — used to wrap alaska↔kamchatka across the date line
const SVG_WIDTH = 749.81909;

interface MapProps {
  territories: Record<string, TerritoryState>;
  playerColors?: Record<string, string>;
}

export function MapSvg({ territories, playerColors = {} }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ label: string; x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  // Shared helper: get center of a territory in SVG root userspace
  const getCenter = (svg: SVGSVGElement, id: string): { x: number; y: number } | null => {
    const svgId = GAME_TO_SVG[id] ?? id;
    const el = svg.getElementById(svgId) as SVGGraphicsElement | null;
    if (!el) return null;
    const bbox = el.getBBox();
    return { x: bbox.x + bbox.width / 2 + LAYER4_TX, y: bbox.y + bbox.height / 2 + LAYER4_TY };
  };

  // Apply continent border colors + ownership fill tints
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    for (const id of TERRITORY_IDS) {
      const svgId = GAME_TO_SVG[id] ?? id;
      const el = svg.getElementById(svgId) as SVGElement | null;
      if (!el) continue;
      const s = (el as SVGElement).style;
      s.stroke = CONTINENT_COLORS[id] ?? "#888";
      s.strokeWidth = "0.8px";
      s.strokeOpacity = "1";
      s.filter = "none";
      const owner = territories[id]?.owner;
      const ownerColor = owner ? (playerColors[owner] ?? null) : null;
      s.fill = ownerColor ? ownerColor + "30" : "transparent";
      s.fillOpacity = "1";
    }
  }, [territories, playerColors]);

  // Inject army labels + sea-route connection lines into the SVG DOM
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const NS = "http://www.w3.org/2000/svg";

    // ── Sea route lines ──────────────────────────────────────
    const oldLines = svg.getElementById("__sea-routes__");
    if (oldLines) oldLines.remove();

    const lineGroup = document.createElementNS(NS, "g");
    lineGroup.setAttribute("id", "__sea-routes__");
    lineGroup.setAttribute("pointer-events", "none");

    for (const [a, b] of SEA_ROUTES) {
      const ca = getCenter(svg, a);
      const cb = getCenter(svg, b);
      if (!ca || !cb) continue;

      // alaska↔kamchatka wraps across the date line — draw two stub lines to edges
      if ((a === "alaska" && b === "kamchatka") || (a === "kamchatka" && b === "alaska")) {
        // alaska is left (~58,89), kamchatka is right (~609,71)
        // Draw line from alaska to left edge and from kamchatka to right edge
        for (const [px, py, ex, ey] of [
          [ca.x, ca.y, 0, ca.y],
          [cb.x, cb.y, SVG_WIDTH, cb.y],
        ] as [number, number, number, number][]) {
          const line = document.createElementNS(NS, "line");
          line.setAttribute("x1", String(px));
          line.setAttribute("y1", String(py));
          line.setAttribute("x2", String(ex));
          line.setAttribute("y2", String(ey));
          line.setAttribute("stroke", "rgba(255,255,255,0.25)");
          line.setAttribute("stroke-width", "0.6");
          line.setAttribute("stroke-dasharray", "2 2");
          lineGroup.appendChild(line);
        }
        continue;
      }

      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", String(ca.x));
      line.setAttribute("y1", String(ca.y));
      line.setAttribute("x2", String(cb.x));
      line.setAttribute("y2", String(cb.y));
      line.setAttribute("stroke", "rgba(255,255,255,0.25)");
      line.setAttribute("stroke-width", "0.6");
      line.setAttribute("stroke-dasharray", "2 2");
      lineGroup.appendChild(line);
    }

    // Insert lines BEFORE army labels so labels render on top
    svg.insertBefore(lineGroup, svg.firstChild);

    // ── Army labels ──────────────────────────────────────────
    const oldGroup = svg.getElementById("__army-labels__");
    if (oldGroup) oldGroup.remove();

    const labelGroup = document.createElementNS(NS, "g");
    labelGroup.setAttribute("id", "__army-labels__");
    labelGroup.setAttribute("pointer-events", "none");

    for (const id of TERRITORY_IDS) {
      const c = getCenter(svg, id);
      if (!c) continue;

      const st = territories[id];
      const armies = st?.armies ?? 0;
      const owner = st?.owner;
      const ownerColor = owner ? (playerColors[owner] ?? "#888") : null;

      if (ownerColor) {
        const circle = document.createElementNS(NS, "circle");
        circle.setAttribute("cx", String(c.x));
        circle.setAttribute("cy", String(c.y));
        circle.setAttribute("r", "5");
        circle.setAttribute("fill", ownerColor);
        circle.setAttribute("opacity", "0.85");
        labelGroup.appendChild(circle);
      }

      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", String(c.x));
      text.setAttribute("y", String(c.y));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "central");
      text.setAttribute("fill", ownerColor ? "#fff" : "rgba(202,196,208,0.7)");
      text.setAttribute("font-size", "4.5");
      text.setAttribute("font-family", "'Roboto Condensed', sans-serif");
      text.setAttribute("font-weight", "700");
      text.style.userSelect = "none";
      text.textContent = String(armies);
      labelGroup.appendChild(text);
    }

    svg.appendChild(labelGroup);
  }, [territories, playerColors]);

  const resolveTerritory = (target: Element): string | null => {
    let el: Element | null = target;
    while (el && el !== containerRef.current) {
      if (el.id) {
        const gameId = SVG_TO_GAME[el.id] ?? el.id;
        if (TERRITORY_IDS.includes(gameId)) return gameId;
      }
      el = el.parentElement;
    }
    return null;
  };

  const transform = `translate(${offset.x}px,${offset.y}px)`;

  return (
    <section className="panel map-panel">
      <span className="panel-title">World Map</span>
      <div
        className="map-stage"
        onMouseDown={(e) => {
          dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
        }}
        onMouseMove={(e) => {
          if (dragRef.current) {
            setOffset({
              x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
              y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
            });
            return;
          }
          const id = resolveTerritory(e.target as Element);
          if (id) {
            const st = territories[id];
            setHover({
              label: `${id.replace(/_/g, " ")} · ${st?.owner ?? "—"} · ${st?.armies ?? 0}`,
              x: e.clientX,
              y: e.clientY,
            });
          } else {
            setHover(null);
          }
        }}
        onMouseUp={() => { dragRef.current = null; }}
        onMouseLeave={() => { dragRef.current = null; setHover(null); }}
      >
        <div
          ref={containerRef}
          className="risk-svg-container"
          style={{ transform, transformOrigin: "0 0" }}
          dangerouslySetInnerHTML={{ __html: riskBoardSvg }}
        />
      </div>

      {hover && (
        <div className="map-tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          {hover.label}
        </div>
      )}
    </section>
  );
}
