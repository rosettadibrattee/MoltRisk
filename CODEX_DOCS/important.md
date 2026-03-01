# 0) MVP Definition (Lock It)

**MVP =** user runs Docker Compose → opens web → creates game → adds N AI agents (LLM/Ollama) → clicks Start → agents play autonomously until someone wins → UI streams live map + chat + treaties + action log.

**Hard constraints**

* Max 8 players
* Turn limit 3 minutes (agents: 30s compute cap, configurable)
* Full state JSON delivered to agents
* Agents return strict JSON actions
* Classic Risk rules, missions, cards, dice

---

# 1) Repo Structure (Codex should create exactly this)

```
risk-ai/
  README.md
  docker-compose.yml
  .env.example

  backend/
    Dockerfile
    pyproject.toml
    src/
      app/
        main.py
        settings.py
        api/
          routes_games.py
          routes_ws.py
          routes_agents.py
        core/
          engine.py
          rules.py
          rng.py
          missions.py
          cards.py
          treaties.py
          validation.py
          state.py
          events.py
        agents/
          base.py
          heuristic.py
          llm_agent.py
          providers/
            ollama.py
            openai_compat.py
        db/
          models.py
          session.py
          repo.py
        maps/
          classic/
            territories.json
            continents.json
            adjacency.json
        util/
          ids.py
          timeouts.py

  frontend/
    Dockerfile
    package.json
    vite.config.ts
    src/
      main.tsx
      app.tsx
      api/
        client.ts
        ws.ts
        types.ts
      pages/
        home.tsx
        game.tsx
      components/
        map_svg.tsx
        player_table.tsx
        chat.tsx
        treaties.tsx
        log.tsx
        timer.tsx
      assets/
        map.svg
```

---

# 2) State, Events, and Contracts (The Core That Prevents Chaos)

## 2.1 Canonical GameState JSON (server-authoritative)

Codex must implement a single JSON object returned by REST and pushed via WebSocket:

```json
{
  "game_id": "g_123",
  "status": "lobby|running|finished",
  "seed": 123456,
  "turn": 7,
  "current_player": "p3",
  "phase": "reinforce|attack|fortify",
  "turn_deadline_ts": 1760000000,

  "players": [
    {
      "id": "p1",
      "name": "Agent 1",
      "kind": "agent|human",
      "alive": true,
      "color": "#...",
      "armies_in_hand": 5,
      "cards": ["c12","c88"],
      "mission": { "type": "control_territories", "n": 24 },
      "reputation": 0.72,
      "personality": { "aggression":0.7,"deception":0.4,"cooperation":0.6,"risk":0.5 }
    }
  ],

  "territories": {
    "Alaska": { "owner":"p1", "armies": 7 },
    "Brazil": { "owner":"p4", "armies": 2 }
  },

  "treaties": [
    { "id":"t1","type":"non_aggression","players":["p1","p4"],"expires_turn":10 }
  ],

  "chat": [
    { "id":"m1","ts":..., "from":"p2", "to":null, "channel":"public", "text":"..." }
  ],

  "log": [
    { "id":"e1","ts":..., "type":"attack", "data":{...} }
  ]
}
```

**Important:** full state includes **all players’ cards** because you asked “poker table feel”. If you later want secrecy, that becomes a v2 change.

## 2.2 Event Envelope (WebSocket)

Every WS push is:

```json
{ "type": "state|event", "payload": {...} }
```

Where:

* `type=state` contains full `GameState`
* `type=event` contains one `GameEvent`

---

# 3) Backend API Spec (Exact Endpoints)

## 3.1 REST Endpoints

### Create game

`POST /api/games`
Body:

```json
{ "map_id":"classic", "seed": null }
```

Response: `GameState`

### Add AI agent player

`POST /api/games/{game_id}/players/agent`
Body:

```json
{
  "name":"Agent 1",
  "provider":"ollama|openai_compat",
  "model":"llama3.1:8b",
  "endpoint":"http://ollama:11434",
  "api_key": null,
  "personality": { "aggression":0.7, "deception":0.6, "cooperation":0.4, "risk":0.8 },
  "tier":"easy|normal|hard"
}
```

Response: player object

### Add human player

`POST /api/games/{game_id}/players/human`
Body:

```json
{ "name":"Narciso" }
```

### Start game

`POST /api/games/{game_id}/start`
Response: `GameState`

### Human action submit (only if humans join)

`POST /api/games/{game_id}/actions`
Body: `ActionBundle` (same schema as agents)
Response: accepted/rejected + new state

### Get game state

`GET /api/games/{game_id}`
Response: `GameState`

---

## 3.2 WebSocket Endpoint

`WS /ws/games/{game_id}`

Server behavior:

* On connect: push `state`
* On each tick/action: push `event` then `state`
* Handle disconnect gracefully (do not crash game loop)

FastAPI has an official minimal WebSocket/broadcast pattern you can base on. ([FastAPI][1])

---

# 4) Game Loop Spec (How the Server Actually Runs the Match)

Codex needs this or it will implement spaghetti.

## 4.1 Single game loop (async task per game)

* When game starts:

  * create `asyncio.Task(game_runner(game_id))`
* Game runner:

  * while status running:

    * set deadline = now + 180s
    * if current player is agent:

      * call agent with timeout 30s
      * validate actions
      * apply actions phase-by-phase
    * if current player is human:

      * wait for human action until deadline
      * else auto-pass
    * advance phase/turn
    * check victory
    * broadcast

## 4.2 Validation rules

* All actions must be valid for the current phase
* Each action applied sequentially
* If invalid → reject that action only (or reject bundle; pick one and keep consistent)
* If bundle empty or rejected → auto-pass phase

---

# 5) Rules Implementation (Minimal, Complete)

Codex should implement these modules:

## 5.1 Reinforcement

* base troops = territories_owned // 3 (min 3)
* * continent bonuses
* * mission irrelevant
* place troops onto owned territories

## 5.2 Attack

* choose from owned territory with armies >= 2
* choose adjacent enemy
* dice: attacker up to 3, defender up to 2
* resolve losses
* if defender reaches 0: territory conquered → attacker must move troops (min 1, max available-1)

## 5.3 Fortify

* move troops between connected owned territories (classic rule: single move)
* enforce adjacency-path connectivity in owned graph

## 5.4 Cards

* if conquered at least 1 territory this turn → draw 1 card
* trading sets yields troops (classic escalating values; keep simple: 4/6/8/10/12/15 then +5 each)
* **Trading requires trade treaty** with at least one counterparty if you want exchange; BUT classic Risk trading is self-only. Your spec says treaty required for exchanging cards/resources—so implement:

  * Self trade always allowed
  * Card exchange between players requires active `trade` treaty

## 5.5 Missions

Implement mission deck minimal:

* control 24 territories
* control 18 + 2 troops each
* control two continents combinations
* destroy target player (fallback rule if target eliminated: convert to control 24)

---

# 6) Treaty + Diplomacy Minimal Spec

## 6.1 Types (MVP)

* `non_aggression`: blocks attacks between treaty members
* `trade`: enables exchanging cards/resources (resources = cards only in MVP)

## 6.2 Offer/Accept Flow

Treaty is a 2-step protocol:

1. Offer event created by proposer:

```json
{ "type":"treaty_offer", "to":"p4", "treaty":{...} }
```

2. Target accepts/rejects:

```json
{ "type":"treaty_response", "offer_id":"...", "accept": true }
```

Once accepted:

* treaty becomes active in state
* visible in UI

Breaking:

* optional action `break_treaty` available anytime
* reputation penalty applied

**Deception stays social:** agents can lie in chat; treaties are the only binding layer.

---

# 7) Agent Implementation Requirements (Codex must build these 2 agents)

## 7.1 HeuristicAgent (baseline, to prove game loop)

* Reinforce: spread to borders / highest threat territories
* Attack: only if strong advantage (armies >= defender+2)
* Fortify: move troops toward frontline

## 7.2 LLMAgent (core)

* Provider supports:

  * Ollama HTTP API
  * OpenAI-compatible Chat Completions endpoint
* Prompt must:

  * restate rules briefly
  * supply personality and current mission
  * provide the full state JSON and recent log (last N events, e.g., 50)
  * require JSON-only output (no markdown)
* Validate response strictly; if parse fails → auto-pass

### Prompt Template (minimal, effective)

System:

* “You are a Risk player. Output strict JSON that matches the schema. No extra text.”
* Personality + tier guidance
* Treaty constraints

User:

* mission
* state JSON
* last events

Hidden reasoning toggle:

* If “show thinking” enabled, request short rationale field:

  * `meta.rationale` (but still keep it optional)

---

# 8) Frontend Spec (Minimal but Polished)

Codex needs exact screens and components.

## 8.1 Home (Lobby)

* Create game
* Add agents (form)

  * provider, endpoint, model, api key (stored locally in browser state; sent to backend)
  * personality sliders (0–1)
  * tier selector
* Add humans (name)
* Start game button

## 8.2 Game Screen

Layout:

* Center: SVG map (pan/zoom)
* Right: Player table “poker table feel” (cards visible, mission visible, armies counts)
* Bottom: Chat (public + DMs)
* Left: Treaties panel + offers
* Top: Turn bar (current player, phase, timer)

Map interactions:

* Spectators: hover shows territory tooltip
* Humans: click to select territories and submit actions (optional in MVP if you want only AI—BUT you said humans can participate; still, MVP can be AI-only with spectator, and add human control as v1.1)

Pan/zoom: use `svg-pan-zoom` with inline SVG. ([GitHub][2])

---

# 9) Docker + Env Requirements (Codex must ship)

## 9.1 docker-compose.yml (MVP)

* backend (8000)
* frontend (3000)
* ollama (11434) optional profile

## 9.2 .env.example

Backend:

* `DB_URL=sqlite:///./data.db`
* `DEFAULT_AGENT_TIMEOUT=30`
* `TURN_SECONDS=180`

Frontend:

* `VITE_API_BASE=http://localhost:8000`

---

# 10) Codex “Single Iteration” Task List (Atomic, Executable)

Give Codex *this order*.

## Task A — Backend skeleton

1. FastAPI app + health endpoint
2. SQLite setup + models + repo
3. In-memory game registry (dict)

## Task B — Game engine core

4. Map load (territories/adjacency/continents JSON)
5. GameState init
6. Reinforcement rules
7. Attack rules + dice
8. Fortify rules
9. Cards + mission deck
10. Victory check

## Task C — API + WebSockets

11. REST routes: create game / add agent / start / get state
12. WS route: broadcast state
13. Connection manager

## Task D — Agent runtime

14. BaseAgent interface
15. HeuristicAgent
16. LLMAgent + providers (ollama + openai compat)
17. JSON schema validation + timeout handling

## Task E — Game loop

18. asyncio task per game
19. phase progression + deadlines
20. apply actions; broadcast after each phase

## Task F — Frontend

21. Lobby UI + agent form
22. WS client + render state
23. SVG map view + ownership coloring
24. Player table + cards + mission
25. Chat + treaties panels (read-only ok first; then wire offers)

## Task G — Polish & fail-safes

26. Graceful invalid agent outputs
27. Graceful disconnects
28. “Reset game” button
29. README with exact commands

---

# 11) What To Put In README (so it’s actually runnable)

* Requirements: Docker
* Quickstart:

  * `cp .env.example .env`
  * `docker compose up --build`
  * open `http://localhost:3000`
* Ollama note:

  * how to pull a model
  * how to set endpoint
* Troubleshooting:

  * ports
  * CORS
  * WS connection

---

# 12) Minimal “Done” Acceptance Tests

Codex should implement a tiny smoke-test script:

* Create game
* Add 4 heuristic agents
* Start game
* Wait for finish or 200 turns cap
* Assert winner exists

This prevents “it runs” lies.
