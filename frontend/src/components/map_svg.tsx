import { useMemo, useState } from "react";
import type { Player, TerritoryState } from "../api/types";

interface MapProps {
  territories: Record<string, TerritoryState>;
  players: Player[];
}

// Stylized territory layout: center positions (cx, cy) and polygon paths
// Arranged as a recognizable world map with proper continental positioning
const TERRITORIES: Record<string, { name: string; cx: number; cy: number; path: string }> = {
  // ─── North America ───
  alaska:                 { name: "Alaska",       cx: 75,  cy: 68,  path: "M40,45 L70,35 L110,40 L115,65 L105,95 L70,100 L40,85 Z" },
  northwest_territory:    { name: "NW Territory", cx: 170, cy: 62,  path: "M120,35 L180,25 L230,35 L225,65 L210,90 L140,95 L115,70 Z" },
  greenland:              { name: "Greenland",    cx: 320, cy: 40,  path: "M280,20 L330,10 L370,20 L365,50 L340,70 L290,60 L275,40 Z" },
  alberta:                { name: "Alberta",      cx: 135, cy: 125, path: "M100,100 L160,100 L170,120 L165,150 L110,150 L95,130 Z" },
  ontario:                { name: "Ontario",      cx: 215, cy: 125, path: "M175,100 L255,100 L260,125 L250,150 L185,155 L170,130 Z" },
  quebec:                 { name: "Quebec",       cx: 305, cy: 115, path: "M265,90 L330,85 L350,105 L340,140 L280,145 L260,120 Z" },
  western_united_states:  { name: "Western US",   cx: 120, cy: 190, path: "M80,160 L155,155 L165,180 L155,220 L90,225 L75,195 Z" },
  eastern_united_states:  { name: "Eastern US",   cx: 210, cy: 195, path: "M165,160 L260,155 L270,185 L255,225 L175,225 L160,195 Z" },
  central_america:        { name: "C. America",   cx: 165, cy: 275, path: "M130,245 L195,240 L210,270 L195,305 L145,310 L125,280 Z" },

  // ─── South America ───
  venezuela:              { name: "Venezuela",    cx: 240, cy: 340, path: "M200,315 L275,310 L290,340 L275,370 L210,375 L195,350 Z" },
  peru:                   { name: "Peru",         cx: 220, cy: 420, path: "M185,385 L255,380 L265,415 L250,455 L195,460 L180,425 Z" },
  brazil:                 { name: "Brazil",       cx: 310, cy: 405, path: "M270,365 L360,360 L375,400 L355,445 L280,450 L260,410 Z" },
  argentina:              { name: "Argentina",    cx: 250, cy: 510, path: "M215,470 L285,465 L295,505 L275,555 L225,560 L210,520 Z" },

  // ─── Europe ───
  iceland:                { name: "Iceland",      cx: 420, cy: 65,  path: "M400,48 L440,45 L450,60 L445,80 L415,83 L395,70 Z" },
  scandinavia:            { name: "Scandinavia",  cx: 495, cy: 65,  path: "M465,40 L520,35 L535,55 L530,90 L480,95 L460,70 Z" },
  ukraine:                { name: "Ukraine",      cx: 575, cy: 105, path: "M540,80 L615,75 L630,100 L620,135 L555,140 L535,115 Z" },
  great_britain:          { name: "Britain",      cx: 425, cy: 130, path: "M405,112 L445,108 L455,125 L450,148 L415,152 L400,135 Z" },
  northern_europe:        { name: "N. Europe",    cx: 490, cy: 140, path: "M460,120 L525,115 L535,135 L528,162 L470,167 L455,145 Z" },
  western_europe:         { name: "W. Europe",    cx: 435, cy: 200, path: "M408,175 L465,170 L475,195 L465,225 L420,230 L405,205 Z" },
  southern_europe:        { name: "S. Europe",    cx: 510, cy: 205, path: "M478,180 L545,175 L560,200 L548,232 L490,237 L475,210 Z" },

  // ─── Africa ───
  north_africa:           { name: "N. Africa",    cx: 460, cy: 310, path: "M410,280 L510,275 L525,305 L515,340 L425,345 L405,315 Z" },
  egypt:                  { name: "Egypt",        cx: 555, cy: 300, path: "M525,278 L590,273 L600,295 L592,325 L535,330 L520,305 Z" },
  east_africa:            { name: "E. Africa",    cx: 575, cy: 390, path: "M545,355 L610,350 L625,385 L610,425 L555,430 L540,395 Z" },
  congo:                  { name: "Congo",        cx: 505, cy: 400, path: "M475,375 L540,370 L550,395 L540,425 L485,430 L470,405 Z" },
  south_africa:           { name: "S. Africa",    cx: 520, cy: 480, path: "M485,450 L555,445 L565,475 L550,510 L495,515 L480,485 Z" },
  madagascar:             { name: "Madagascar",   cx: 610, cy: 480, path: "M590,455 L630,450 L638,475 L628,505 L595,510 L585,480 Z" },

  // ─── Asia ───
  ural:                   { name: "Ural",         cx: 680, cy: 80,  path: "M650,55 L710,50 L722,75 L715,108 L660,113 L645,85 Z" },
  siberia:                { name: "Siberia",      cx: 770, cy: 65,  path: "M730,40 L810,35 L825,60 L815,95 L740,100 L725,70 Z" },
  yakutsk:                { name: "Yakutsk",      cx: 860, cy: 55,  path: "M830,30 L895,25 L908,50 L900,80 L840,85 L825,58 Z" },
  kamchatka:              { name: "Kamchatka",    cx: 940, cy: 60,  path: "M910,35 L970,30 L985,55 L975,88 L920,93 L905,65 Z" },
  irkutsk:                { name: "Irkutsk",      cx: 845, cy: 120, path: "M815,98 L878,93 L890,115 L882,145 L823,150 L810,125 Z" },
  mongolia:               { name: "Mongolia",     cx: 790, cy: 155, path: "M755,135 L830,130 L843,152 L833,178 L763,183 L750,160 Z" },
  japan:                  { name: "Japan",        cx: 935, cy: 145, path: "M915,125 L955,120 L965,140 L958,168 L920,172 L910,150 Z" },
  afghanistan:            { name: "Afghanistan",  cx: 670, cy: 175, path: "M638,155 L705,150 L718,172 L708,200 L648,205 L635,180 Z" },
  middle_east:            { name: "Mid. East",    cx: 610, cy: 255, path: "M575,232 L648,227 L660,250 L650,280 L585,285 L570,260 Z" },
  india:                  { name: "India",        cx: 720, cy: 245, path: "M688,220 L755,215 L768,240 L755,272 L698,277 L683,250 Z" },
  siam:                   { name: "Siam",         cx: 790, cy: 270, path: "M762,248 L820,243 L832,265 L822,295 L770,300 L758,275 Z" },
  china:                  { name: "China",        cx: 770, cy: 195, path: "M728,170 L818,165 L832,190 L820,220 L738,225 L722,198 Z" },

  // ─── Australia ───
  indonesia:              { name: "Indonesia",    cx: 830, cy: 370, path: "M798,350 L865,345 L878,365 L868,395 L808,400 L795,375 Z" },
  new_guinea:             { name: "New Guinea",   cx: 920, cy: 375, path: "M890,355 L952,350 L965,372 L955,398 L898,403 L885,378 Z" },
  western_australia:      { name: "W. Australia", cx: 860, cy: 455, path: "M825,430 L895,425 L908,450 L898,480 L835,485 L820,458 Z" },
  eastern_australia:      { name: "E. Australia", cx: 935, cy: 460, path: "M905,435 L970,430 L983,455 L972,485 L912,490 L900,462 Z" },
};

// Continent labels
const CONTINENT_LABELS = [
  { label: "North America", x: 170, y: 170 },
  { label: "South America", x: 260, y: 430 },
  { label: "Europe",        x: 490, y: 160 },
  { label: "Africa",        x: 510, y: 370 },
  { label: "Asia",          x: 770, y: 140 },
  { label: "Australia",     x: 890, y: 430 },
];

export function MapSvg({ territories, players }: MapProps) {
  const [hover, setHover] = useState<{ label: string; owner: string; armies: number; x: number; y: number } | null>(null);

  const colorMap = useMemo(() => {
    const m: Record<string, string> = {};
    players.forEach((p) => { m[p.id] = p.color; });
    return m;
  }, [players]);

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    players.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [players]);

  return (
    <>
      <svg viewBox="0 0 1020 580" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Risk world map">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Continent labels */}
        {CONTINENT_LABELS.map((c) => (
          <text key={c.label} x={c.x} y={c.y} className="continent-label">{c.label}</text>
        ))}

        {/* Territory shapes */}
        {Object.entries(TERRITORIES).map(([id, t]) => {
          const state = territories[id];
          const fill = state ? (colorMap[state.owner] ?? "#333") : "#222";
          return (
            <g key={id}>
              <polygon
                points={t.path.replace(/[MLZ]/g, "").replace(/,/g, " ")}
                className="territory-shape"
                fill={fill}
                fillOpacity={0.75}
                onMouseEnter={(e) => setHover({
                  label: t.name,
                  owner: state ? (nameMap[state.owner] ?? state.owner) : "—",
                  armies: state?.armies ?? 0,
                  x: e.clientX, y: e.clientY,
                })}
                onMouseMove={(e) => hover && setHover({ ...hover, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
              />
              {/* Army count circle */}
              {state && (
                <>
                  <circle cx={t.cx} cy={t.cy} r={10} fill="rgba(0,0,0,0.55)" className="territory-count-bg" />
                  <text x={t.cx} y={t.cy + 1} className="territory-count">{state.armies}</text>
                </>
              )}
              {/* Territory name */}
              <text x={t.cx} y={t.cy - 14} className="territory-label">{t.name}</text>
            </g>
          );
        })}
      </svg>

      {hover && (
        <div className="map-tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <div className="tt-name">{hover.label}</div>
          <div className="tt-owner">Owner: {hover.owner}</div>
          <div className="tt-armies">Armies: {hover.armies}</div>
        </div>
      )}
    </>
  );
}
