> **Local AI Agent–Based Risk Game (Open Source, Docker Deployable)**

# 1. SYSTEM OVERVIEW

## 1.1 Objective

Build a locally deployable web-based Risk game where:

* 2–8 players
* Players can be human or AI agents
* AI agents are autonomous
* AI agents receive full state JSON every turn
* Agents negotiate, form treaties, trade, deceive
* Game runs to completion without intervention
* System runs entirely via Docker Compose
* Supports Ollama or API-based LLM

Minimal. Clean. Deterministic. Polished.

---

# 2. ARCHITECTURE

## 2.1 High-Level Structure

```
Frontend (React + TS)
    |
    | WebSocket + REST
    |
Backend (FastAPI, Python)
    |
    |--------------------------
    | Game Engine
    | Agent Runtime
    | Treaty Manager
    | Chat Manager
    | RNG Module
    |--------------------------
    |
SQLite DB
    |
Optional: Ollama / External API
```

Server is authoritative.
Clients are dumb renderers.

---

# 3. TECH STACK

## Backend

* Python 3.11+
* FastAPI
* Pydantic
* SQLAlchemy
* SQLite (MVP)
* WebSockets
* Asyncio

## Frontend

* React
* TypeScript
* Vite
* SVG map rendering
* Zustand (state management)

## AI Integration

* Ollama (local models)
* OpenAI-compatible API (optional)
* JSON schema enforcement

## Dev Environment

* Docker Compose
* One command startup

---

# 4. CORE GAME ENGINE SPEC

## 4.1 Game State Model

Canonical state stored in memory and DB.

```python
class GameState:
    game_id: str
    seed: int
    players: Dict[str, Player]
    territories: Dict[str, Territory]
    current_turn: int
    current_player: str
    phase: PhaseEnum
    treaties: List[Treaty]
    chat_log: List[ChatMessage]
    action_log: List[GameEvent]
    mission_deck: List[Mission]
    deck: List[Card]
```

---

## 4.2 Territory Model

```python
class Territory:
    id: str
    owner_id: str
    army_count: int
    adjacent_ids: List[str]
    continent_id: str
```

Adjacency graph hardcoded JSON.

---

## 4.3 Turn Flow

For each player:

1. Reinforcement Phase
2. Attack Phase
3. Fortify Phase
4. Card draw (if conquered)
5. Check win
6. Next player

Engine validates every action.

---

## 4.4 Combat

* Dice rolls via seeded RNG
* Max 3 attacker dice
* Max 2 defender dice
* Standard Risk rules
* RNG seeded per game

```python
rng = random.Random(seed)
```

All dice results logged in action_log.

---

## 4.5 Mission Objectives

Classic mission types:

* Destroy specific player
* Control X territories
* Control specific continents

If target eliminated by someone else:

* Convert mission to 24-territory control objective

Victory checked after each turn.

---

# 5. TREATY SYSTEM

## 5.1 Treaty Object

```python
class Treaty:
    id: str
    type: str  # "non_aggression", "trade"
    players: List[str]
    expires_turn: int
    reputation_penalty_on_break: float
```

---

## 5.2 Enforcement Rules

Non-aggression:

* Engine blocks attack action

Trade:

* Required for card exchange

Breaking treaty:

* Allowed
* Reputation score decreases
* Logged publicly

Reputation affects AI prompt.

---

# 6. AGENT SYSTEM

## 6.1 Agent Base Interface

```python
class BaseAgent:
    async def take_turn(self, game_state: dict) -> dict:
        pass

    async def receive_message(self, message: dict):
        pass
```

---

## 6.2 LLM Agent Wrapper

Components:

* Personality parameters
* Strategic memory (dict)
* Prompt builder
* JSON output validator

Memory structure:

```python
{
    "alliances": [...],
    "enemy_priorities": [...],
    "continent_targets": [...],
    "trust_scores": {...}
}
```

Memory exists only per game (MVP).

---

## 6.3 Agent Input Payload

Each turn:

```json
{
  "self_id": "p3",
  "current_phase": "reinforce",
  "full_state": {...},
  "history_log": [...],
  "treaties": [...],
  "personality": {...}
}
```

---

## 6.4 Agent Output Schema

Strict JSON only:

```json
{
  "phase_actions": [...],
  "chat": [...],
  "treaty_offer": {...}
}
```

Backend validates against schema.

Invalid → auto-pass phase.

---

## 6.5 Timeout Rules

* Agent execution limit: 30 seconds
* Hard cancel via asyncio timeout
* On timeout → auto-pass remaining phase

---

# 7. CHAT SYSTEM

Channels:

* Public
* Private DM
* System announcements

Messages appended to chat_log and included in next turn input.

---

# 8. FRONTEND SPEC

## 8.1 Pages

### Home

* Create game
* Add agents
* Add humans
* Configure API keys
* Start game

### Game View

* SVG Map
* Player info panel
* Cards panel
* Treaty panel
* Chat window
* Action log
* Turn timer

---

## 8.2 Map Rendering

* Inline SVG
* Territories colored by owner
* Clickable (human player)
* Highlight valid targets

---

# 9. DATABASE SCHEMA

## games

* id
* seed
* status
* created_at

## players

* id
* game_id
* type (human/agent)
* reputation
* personality_json

## territories

* id
* game_id
* owner_id
* army_count

## treaties

* id
* game_id
* type
* players_json
* expires_turn

## chat_messages

* id
* game_id
* sender_id
* receiver_id
* channel
* message
* timestamp

## action_log

* id
* game_id
* turn
* event_json

---

# 10. DOCKER SETUP

```yaml
version: "3.9"

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
    ports:
      - "11434:11434"
```

---

# 11. DEVELOPMENT PLAN

## PHASE 1 — Engine Core (Week 1)

* Territory + adjacency
* Player model
* Turn flow
* Combat resolution
* Win detection
* Basic REST API

Deliverable:
Game playable with manual curl commands.

---

## PHASE 2 — Basic UI (Week 2)

* SVG map
* Player panel
* Turn transitions
* WebSocket state streaming
* Human playable game

Deliverable:
Two humans can play locally.

---

## PHASE 3 — Basic AI (Week 3)

* Heuristic agent
* Random reinforcement
* Basic attack logic
* Full game auto-play

Deliverable:
AI vs AI full game completes.

---

## PHASE 4 — LLM Integration (Week 4)

* LLM wrapper
* JSON schema validation
* Personality injection
* Strategic memory
* Chat generation

Deliverable:
LLM agents negotiate and play to completion.

---

## PHASE 5 — Diplomacy System (Week 5)

* Treaty objects
* Enforcement
* Reputation
* Trade agreements

Deliverable:
AI agents form and break alliances.

---

## PHASE 6 — Polish & Stability (Week 6)

* Error handling
* Timeout enforcement
* UI polish
* Animation
* Docker cleanup
* README + setup docs

Deliverable:
One-command launch polished MVP.

---

# 12. SUCCESS CRITERIA

System is considered complete when:

* 6 AI agents can autonomously finish a game
* Treaties enforced correctly
* No crashes over full match
* Deterministic replays via seed
* Humans can spectate and chat

---

# 13. FUTURE EXTENSION HOOKS (Post-MVP)

* Persistent agent memory
* Replay timeline
* Tournament mode
* Fog of war
* Custom maps
* Plugin agent marketplace
* Multi-node distributed games

---

# 14. FINAL PRODUCT DEFINITION

A locally deployable, open-source, AI-powered Risk engine with structured diplomacy, autonomous agents, and clean UI — minimal, extensible, complete.

---
