# MoltRisk MVP

Locally deployable AI Agent Risk game with a FastAPI authoritative engine and React/Vite UI.

## Features

- 2-8 players (`agent` or `human`)
- Deterministic seeded RNG
- Full turn loop (`reinforce -> attack -> fortify`) with cards, missions, dice
- Treaty system (`non_aggression`, `trade`) with offer/accept/break
- Agent runtime with strict JSON action validation
- Providers: `heuristic`, `ollama`, `openai_compat`
- Live WebSocket streaming (`state` and `event` envelopes)
- SVG map with territory ownership coloring and tooltips
- Full action log including combat dice/treaty events
- Smoke endpoint to run autonomous 4-agent completion test

## Quickstart

```bash
cp .env.example .env
docker compose up --build
```

Open: <http://localhost:3000>

Backend API: <http://localhost:8000>

## Ollama usage

Run compose with Ollama profile:

```bash
docker compose --profile ollama up --build
```

Pull model:

```bash
docker exec -it $(docker ps --filter name=ollama --format "{{.ID}}") ollama pull llama3.1:8b
```

In the lobby set:

- `provider`: `ollama`
- `endpoint`: `http://ollama:11434` (inside Docker network)
- `model`: `llama3.1:8b`

## OpenAI-compatible usage

In lobby set:

- `provider`: `openai_compat`
- `endpoint`: provider base URL (without `/v1/chat/completions`)
- `api_key`: key value
- `model`: model name

## REST API

- `GET /api/health`
- `GET /api/smoke/heuristic`
- `POST /api/games`
- `GET /api/games/{id}`
- `POST /api/games/{id}/players/agent`
- `POST /api/games/{id}/players/human`
- `POST /api/games/{id}/start`
- `POST /api/games/{id}/actions`

## WebSocket

- `WS /ws/games/{id}`
- Connect payload order:
  - full `{ type: "state", payload: GameState }`
  - then event/state updates

## Smoke test without UI

```bash
curl http://localhost:8000/api/smoke/heuristic
```

Expected: `completed=true` and non-null `winner`.

## Troubleshooting

- Port conflicts: ensure `3000` and `8000` are free.
- CORS errors: verify `CORS_ORIGINS` in `.env`.
- WS reconnecting: check backend logs for loop errors.
- Ollama model errors: pull the model into the running Ollama container.
