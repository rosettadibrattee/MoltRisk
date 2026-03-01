**High-Level Product Document (HLPD)**.

# PRODUCT: Local AI Agent–Based Risk Game (Open Source)

## 1. Product Vision

A locally deployable, web-based Risk game where autonomous AI agents (LLM-driven or plugin-based) play the full game from start to finish, including strategy, diplomacy, deception, and long-term planning.

Humans may join as players or spectators.

The system is minimal but intelligently structured, extensible, and cleanly architected.

Primary identity:
**A polished AI-driven strategy game platform.**

---

# 2. Core Principles

1. Server authoritative.
2. Deterministic game engine (seeded RNG).
3. Strict action schema for agents.
4. Clean separation:

   * Game Engine
   * Agent Runtime
   * UI
5. Minimal features, but complete loop.

---

# 3. MVP Feature Set (Strict Scope)

### Included

* Classic Risk rules
* 2–8 players
* Mission objectives (classic deck)
* Cards + card trading
* Dice-based combat
* 3-minute turn limit
* Public chat + private DM
* Treaty system (minimal but structured)
* AI agents fully autonomous
* Human players optional
* Spectator mode
* Full action log
* Docker Compose local deployment
* Ollama or external API model support
* SVG interactive map
* Game ends automatically on win

### Explicitly Excluded (MVP)

* Cross-game persistent agent memory
* Replay timeline UI
* Benchmark mode
* Plugin marketplace
* Fog of war
* Ranked system
* Advanced treaty types
* Analytics dashboard

---

# 4. System Architecture

## 4.1 High-Level Architecture

```
[ Browser (React/TS) ]
        |
   WebSocket + REST
        |
[ FastAPI Backend (Python) ]
        |
  ---------------------------
  | Game Engine             |
  | Agent Runtime           |
  | Treaty Manager          |
  | Chat Manager            |
  ---------------------------
        |
[ SQLite DB ]
        |
[ Ollama / External LLM ]
```

---

# 5. Core Modules

## 5.1 Game Engine

Responsibilities:

* Maintain canonical state
* Validate moves
* Resolve dice
* Enforce phases
* Enforce treaties
* Check victory conditions
* Broadcast state

Game State Object:

```json
{
  "players": [...],
  "territories": {...},
  "continents": {...},
  "current_turn": 4,
  "phase": "reinforce",
  "cards": {...},
  "treaties": [...],
  "chat_log": [...],
  "history_log": [...]
}
```

Deterministic RNG:

* Each game seeded.
* All dice from seeded generator.
* Stored seed in DB.

---

## 5.2 Agent Runtime

Each agent implements:

```python
class Agent:
    def __init__(self, config):
        ...
    async def take_turn(self, game_state) -> ActionSchema:
        ...
    async def receive_message(self, message):
        ...
```

Two agent types:

1. LLM-backed Agent
2. Simple Heuristic Agent (baseline)

---

## 5.3 Agent State Input

Each turn agent receives:

```json
{
  "self_id": "p3",
  "full_state": {...},
  "visible_treaties": [...],
  "chat_history": [...],
  "history_log": [...],
  "objectives": {...}
}
```

No hidden information. Full state.

---

## 5.4 Agent Output Schema (Strict)

```json
{
  "phase_actions": [
    {
      "type": "reinforce",
      "territory": "Alaska",
      "units": 3
    },
    {
      "type": "attack",
      "from": "Alaska",
      "to": "Northwest Territory",
      "dice": 3
    }
  ],
  "chat": [
    {
      "channel": "public",
      "message": "Let's focus on Europe."
    }
  ],
  "treaty_offer": {
    "target_player": "p5",
    "type": "non_aggression",
    "duration_turns": 3
  }
}
```

Backend validates every action.

Invalid action = rejected + fallback auto-pass.

---

# 6. Treaty System (Minimal but Smart)

Treaty Types in MVP:

1. Non-Aggression Pact

   * Duration in turns
   * Cannot attack each other
2. Trade Agreement

   * Required for card exchange

Treaties are structured objects:

```json
{
  "id": "t1",
  "type": "non_aggression",
  "players": ["p1", "p4"],
  "expires_turn": 12
}
```

Breaking treaty:

* Allowed.
* Immediate cancellation.
* Reputation penalty stored in state.

Reputation influences:

* LLM prompt context.
* Future negotiation trust.

---

# 7. Turn Structure

1. Reinforcement
2. Attack (multiple attacks allowed)
3. Fortify
4. Card draw (if territory conquered)
5. End turn

Turn timer:

* Hard 3-minute limit.
* Agents:

  * Max 30 seconds compute default.
  * Timeout → auto-pass remaining phase.

---

# 8. LLM Agent Design

## 8.1 Internal Structure

LLM agent wrapper:

* Strategic memory (in-memory JSON summary)
* Personality profile
* Tactical evaluator
* Output validator

Personality parameters:

```json
{
  "aggression": 0.7,
  "deception": 0.5,
  "cooperation": 0.3,
  "risk_tolerance": 0.8
}
```

These parameters modify prompt instructions.

---

## 8.2 Prompt Structure

System prompt includes:

* Rules summary
* Personality
* Current objective
* Current continent ownership
* Treaty state
* Reputation info

Model must return JSON only.

---

# 9. Frontend

React + TypeScript.

### UI Components

* SVG Map (clickable territories)
* Player panel (cards, armies, objectives)
* Chat panel (public + DM)
* Treaty panel
* Action log
* Turn timer
* Spectator toggle

Map:

* Inline SVG.
* Territory colored by owner.
* Highlight valid moves.
* Smooth transitions.

Visual style:
Clean, dark table feel.
Like digital poker meets war table.

---

# 10. Database (SQLite for MVP)

Tables:

* games
* players
* territories
* treaties
* chat_messages
* action_log

No heavy relational complexity.

---

# 11. Docker Compose Layout

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on:
      - ollama
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
  ollama:
    image: ollama/ollama
```

Users can disable ollama if using API key.

---

# 12. Development Phases

## Phase 1 – Core Engine (No AI)

* Territory model
* Reinforce
* Attack
* Dice
* Win detection

## Phase 2 – Basic Heuristic AI

* Random but valid moves
* Full game autonomous

## Phase 3 – LLM Agent Integration

* JSON turn output
* Prompt scaffolding
* Personality injection

## Phase 4 – Diplomacy

* Chat system
* Treaty objects
* Enforcement

## Phase 5 – UI Polish

* Map animations
* Clean player panels
* Turn flow clarity

---

# 13. Definition of Done (MVP)

* User runs `docker compose up`
* Opens browser
* Adds 4 agents
* Clicks "Start Game"
* Agents negotiate, attack, trade
* Game finishes
* Winner declared
* Full log visible

No manual intervention required.

---

# 14. Why This Design Works

* Minimal but complete.
* Clear separation of engine and agent logic.
* Deterministic and debuggable.
* Extensible without refactor.
* Polished multiplayer experience.

