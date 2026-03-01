from __future__ import annotations

import asyncio
import json
import random
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fastapi import WebSocket

from app.agents.base import BaseAgent
from app.agents.heuristic import HeuristicAgent
from app.agents.llm_agent import LLMAgent
from app.core import cards, missions, rules, treaties
from app.core.events import make_event
from app.core.rng import GameRng
from app.core.state import (
    ActionBundle,
    ChatMessage,
    GameState,
    GameStatus,
    Phase,
    Player,
    PlayerKind,
    TerritoryState,
    TreatyType,
)
from app.core.validation import filter_actions_for_phase, parse_action_bundle
from app.db.repo import GameRepo
from app.settings import get_settings
from app.util.ids import new_id

COLOR_POOL = [
    "#d9480f",
    "#1864ab",
    "#2b8a3e",
    "#7b2cbf",
    "#e67700",
    "#0b7285",
    "#9c36b5",
    "#495057",
]

INITIAL_ARMIES = {2: 40, 3: 35, 4: 30, 5: 25, 6: 20, 7: 18, 8: 15}


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, game_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(game_id, set()).add(websocket)

    async def disconnect(self, game_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            if game_id in self._connections:
                self._connections[game_id].discard(websocket)

    async def broadcast(self, game_id: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._connections.get(game_id, set()))
        dead: list[WebSocket] = []
        for connection in targets:
            try:
                await connection.send_json(payload)
            except Exception:
                dead.append(connection)
        if dead:
            async with self._lock:
                for connection in dead:
                    self._connections.get(game_id, set()).discard(connection)


@dataclass
class GameRuntime:
    state: GameState
    rng: GameRng
    adjacency: dict[str, list[str]]
    continents: dict[str, dict]
    territories: list[dict[str, str]]
    agents: dict[str, BaseAgent] = field(default_factory=dict)
    human_queues: dict[str, asyncio.Queue[ActionBundle]] = field(default_factory=dict)
    task: asyncio.Task | None = None
    eliminated_by: dict[str, str] = field(default_factory=dict)


class GameManager:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.repo = GameRepo()
        self.connections = ConnectionManager()
        self.games: dict[str, GameRuntime] = {}
        self._map_cache = self._load_map("classic")

    def _load_map(self, map_id: str) -> dict[str, Any]:
        if map_id != "classic":
            raise ValueError("Only classic map is supported in MVP")
        base = Path(__file__).resolve().parent.parent / "maps" / map_id
        with open(base / "territories.json", "r", encoding="utf-8") as f:
            territories = json.load(f)
        with open(base / "continents.json", "r", encoding="utf-8") as f:
            continents = json.load(f)
        with open(base / "adjacency.json", "r", encoding="utf-8") as f:
            adjacency = json.load(f)
        return {"territories": territories, "continents": continents, "adjacency": adjacency}

    def create_game(self, map_id: str = "classic", seed: int | None = None) -> GameState:
        if map_id != "classic":
            raise ValueError("Unsupported map")
        seed = seed or random.randint(1, 999_999_999)
        game_id = new_id("g")
        state = GameState(game_id=game_id, seed=seed)
        runtime = GameRuntime(
            state=state,
            rng=GameRng(seed),
            adjacency=self._map_cache["adjacency"],
            continents=self._map_cache["continents"],
            territories=self._map_cache["territories"],
        )
        self.games[game_id] = runtime
        self.repo.create_game(state)
        return state

    def get_game(self, game_id: str) -> GameState:
        runtime = self.games.get(game_id)
        if runtime:
            return runtime.state
        snapshot = self.repo.get_game_snapshot(game_id)
        if snapshot is None:
            raise KeyError("Game not found")
        return snapshot

    def add_agent_player(self, game_id: str, config: dict[str, Any]) -> Player:
        runtime = self._runtime(game_id)
        state = runtime.state
        if state.status != GameStatus.LOBBY:
            raise ValueError("Cannot add players after game start")
        if len(state.players) >= 8:
            raise ValueError("Max 8 players")

        player = Player(
            id=new_id("p"),
            name=config.get("name", f"Agent {len(state.players) + 1}"),
            kind=PlayerKind.AGENT,
            color=COLOR_POOL[len(state.players) % len(COLOR_POOL)],
            tier=config.get("tier", "normal"),
            personality=config.get("personality", {}),
            mission={"type": "control_24"},
        )
        state.players.append(player)

        provider = config.get("provider", "ollama")
        if provider == "heuristic":
            runtime.agents[player.id] = HeuristicAgent(config)
        elif provider in {"ollama", "openai_compat"}:
            runtime.agents[player.id] = LLMAgent(config)
        else:
            runtime.agents[player.id] = HeuristicAgent(config)

        self.repo.save_state(state)
        return player

    def add_human_player(self, game_id: str, name: str) -> Player:
        runtime = self._runtime(game_id)
        state = runtime.state
        if state.status != GameStatus.LOBBY:
            raise ValueError("Cannot add players after game start")
        if len(state.players) >= 8:
            raise ValueError("Max 8 players")

        player = Player(
            id=new_id("p"),
            name=name,
            kind=PlayerKind.HUMAN,
            color=COLOR_POOL[len(state.players) % len(COLOR_POOL)],
            mission={"type": "control_24"},
        )
        state.players.append(player)
        runtime.human_queues[player.id] = asyncio.Queue()
        self.repo.save_state(state)
        return player

    async def start_game(self, game_id: str) -> GameState:
        runtime = self._runtime(game_id)
        state = runtime.state
        if state.status != GameStatus.LOBBY:
            raise ValueError("Game already started")
        if not 2 <= len(state.players) <= 8:
            raise ValueError("MVP supports 2 to 8 players")

        self._initialize_state(runtime)
        state.status = GameStatus.RUNNING
        state.current_player = state.players[0].id
        self._append_event(runtime, make_event("system", {"message": "Game started"}))
        self.repo.save_state(state)
        await self.broadcast_state(game_id)

        runtime.task = asyncio.create_task(self._run_game(game_id))
        return state

    async def submit_action(self, game_id: str, player_id: str, bundle_payload: dict | str | None) -> tuple[bool, list[str], GameState]:
        runtime = self._runtime(game_id)
        bundle, error = parse_action_bundle(bundle_payload)
        if error or bundle is None:
            return False, [error or "Invalid action bundle"], runtime.state

        player = self._player(runtime.state, player_id)
        if player.kind != PlayerKind.HUMAN:
            return False, ["Only human players can submit via this endpoint"], runtime.state

        queue = runtime.human_queues.setdefault(player_id, asyncio.Queue())
        await queue.put(bundle)
        return True, [], runtime.state

    async def smoke_heuristic(self) -> dict[str, Any]:
        state = self.create_game(seed=1337)
        for idx in range(4):
            self.add_agent_player(
                state.game_id,
                {
                    "name": f"Heuristic {idx + 1}",
                    "provider": "heuristic",
                    "tier": "normal",
                    "personality": {
                        "aggression": 0.5,
                        "deception": 0.2,
                        "cooperation": 0.4,
                        "risk": 0.5,
                    },
                },
            )
        await self.start_game(state.game_id)

        runtime = self._runtime(state.game_id)
        max_wait = 120
        start = time.time()
        while runtime.state.status != GameStatus.FINISHED and time.time() - start < max_wait:
            await asyncio.sleep(0.2)

        return {
            "game_id": state.game_id,
            "status": runtime.state.status,
            "winner": runtime.state.winner,
            "turn": runtime.state.turn,
            "completed": runtime.state.status == GameStatus.FINISHED,
        }

    async def broadcast_state(self, game_id: str) -> None:
        runtime = self._runtime(game_id)
        await self.connections.broadcast(game_id, {"type": "state", "payload": runtime.state.model_dump(mode="json")})

    async def broadcast_event(self, game_id: str, event: dict[str, Any]) -> None:
        await self.connections.broadcast(game_id, {"type": "event", "payload": event})

    def _runtime(self, game_id: str) -> GameRuntime:
        runtime = self.games.get(game_id)
        if runtime is None:
            raise KeyError("Game not found")
        return runtime

    def _initialize_state(self, runtime: GameRuntime) -> None:
        state = runtime.state
        territory_ids = [item["id"] for item in runtime.territories]
        shuffled = territory_ids[:]
        runtime.rng.shuffle(shuffled)

        for territory_id in territory_ids:
            state.territories[territory_id] = TerritoryState(owner=state.players[0].id, armies=1)

        for idx, territory_id in enumerate(shuffled):
            owner = state.players[idx % len(state.players)]
            state.territories[territory_id] = TerritoryState(owner=owner.id, armies=1)

        initial_armies = INITIAL_ARMIES[len(state.players)]
        for player in state.players:
            owned = [territory for territory in state.territories if state.territories[territory].owner == player.id]
            remaining = max(0, initial_armies - len(owned))
            while remaining > 0 and owned:
                target = runtime.rng.choice(owned)
                state.territories[target].armies += 1
                remaining -= 1
            player.armies_in_hand = 0
            player.cards = []
            player.reputation = 1.0
            player.alive = True

        mission_deck = missions.build_missions([p.id for p in state.players])
        runtime.rng.shuffle(mission_deck)
        for player in state.players:
            picked = mission_deck.pop(0)
            attempts = 0
            while picked.type == "destroy_player" and picked.target_player == player.id and mission_deck and attempts < 8:
                mission_deck.append(picked)
                picked = mission_deck.pop(0)
                attempts += 1
            player.mission = picked

        state.deck = cards.build_deck(territory_ids)
        runtime.rng.shuffle(state.deck)
        state.discard = []
        state.turn = 1
        state.phase = Phase.REINFORCE
        state.treaties = []
        state.pending_treaty_offers = []
        state.chat = []
        state.log = []
        state.winner = None
        state.next_trade_value = 4

    def _player(self, state: GameState, player_id: str) -> Player:
        for player in state.players:
            if player.id == player_id:
                return player
        raise ValueError("Player not found")

    def _alive_players(self, state: GameState) -> list[Player]:
        return [player for player in state.players if player.alive]

    def _next_player(self, state: GameState, current_id: str) -> Player:
        alive = self._alive_players(state)
        if not alive:
            raise ValueError("No alive players")
        order = [player.id for player in state.players if player.alive]
        if current_id not in order:
            return alive[0]
        idx = order.index(current_id)
        return self._player(state, order[(idx + 1) % len(order)])

    def _append_event(self, runtime: GameRuntime, event) -> None:
        runtime.state.log.append(event)
        if len(runtime.state.log) > 4000:
            runtime.state.log = runtime.state.log[-4000:]
        self.repo.append_event(runtime.state.game_id, runtime.state.turn, event)

    async def _run_game(self, game_id: str) -> None:
        runtime = self._runtime(game_id)
        state = runtime.state

        try:
            while state.status == GameStatus.RUNNING:
                current = self._player(state, state.current_player or state.players[0].id)
                if not current.alive:
                    current = self._next_player(state, current.id)
                    state.current_player = current.id

                state.conquered_this_turn = False
                reinforcements = rules.reinforcement_for_player(state, current.id, runtime.continents)
                current.armies_in_hand += reinforcements

                self._append_event(
                    runtime,
                    make_event(
                        "reinforcement_grant",
                        {"player": current.id, "units": reinforcements},
                    ),
                )
                await self.broadcast_event(game_id, state.log[-1].model_dump(mode="json"))

                deadline = time.time() + self.settings.turn_seconds
                state.turn_deadline_ts = deadline

                for phase in [Phase.REINFORCE, Phase.ATTACK, Phase.FORTIFY]:
                    state.phase = phase
                    await self.broadcast_state(game_id)

                    bundle = await self._get_bundle(runtime, current, phase, deadline)
                    await self._apply_bundle(runtime, current, bundle, phase)
                    self.repo.save_state(state)
                    await self.broadcast_state(game_id)

                    if state.status == GameStatus.FINISHED:
                        break

                if state.status == GameStatus.FINISHED:
                    break

                if state.conquered_this_turn and state.deck:
                    card = state.deck.pop(0)
                    current.cards.append(card)
                    event = make_event("card_draw", {"player": current.id, "card": card})
                    self._append_event(runtime, event)
                    await self.broadcast_event(game_id, event.model_dump(mode="json"))

                expired = treaties.expire_treaties(state)
                for treaty in expired:
                    event = make_event("treaty_expired", {"treaty": treaty.model_dump(mode="json")})
                    self._append_event(runtime, event)
                    await self.broadcast_event(game_id, event.model_dump(mode="json"))

                winner = self._check_victory(runtime)
                if winner:
                    state.status = GameStatus.FINISHED
                    state.winner = winner.id
                    event = make_event("win", {"winner": winner.id, "name": winner.name})
                    self._append_event(runtime, event)
                    await self.broadcast_event(game_id, event.model_dump(mode="json"))
                    await self.broadcast_state(game_id)
                    self.repo.save_state(state)
                    break

                nxt = self._next_player(state, current.id)
                state.current_player = nxt.id
                state.turn += 1
                self.repo.save_state(state)
                await self.broadcast_state(game_id)

                if state.turn > 500:
                    leader = max(self._alive_players(state), key=lambda p: len(rules.owned_territories(state, p.id)))
                    state.status = GameStatus.FINISHED
                    state.winner = leader.id
                    event = make_event("win", {"winner": leader.id, "name": leader.name, "reason": "turn_cap"})
                    self._append_event(runtime, event)
                    await self.broadcast_event(game_id, event.model_dump(mode="json"))
                    await self.broadcast_state(game_id)
                    self.repo.save_state(state)
                    break
        except Exception as exc:
            event = make_event("error", {"message": f"Game loop error: {exc}"})
            self._append_event(runtime, event)
            await self.broadcast_event(game_id, event.model_dump(mode="json"))
            state.status = GameStatus.FINISHED
            self.repo.save_state(state)
            await self.broadcast_state(game_id)

    async def _get_bundle(self, runtime: GameRuntime, player: Player, phase: Phase, deadline: float) -> ActionBundle:
        state = runtime.state
        if player.kind == PlayerKind.HUMAN:
            queue = runtime.human_queues.setdefault(player.id, asyncio.Queue())
            timeout = max(0.1, deadline - time.time())
            try:
                return await asyncio.wait_for(queue.get(), timeout=timeout)
            except asyncio.TimeoutError:
                event = make_event("timeout", {"player": player.id, "phase": phase.value, "kind": "human"})
                self._append_event(runtime, event)
                await self.broadcast_event(state.game_id, event.model_dump(mode="json"))
                return ActionBundle()

        agent = runtime.agents.get(player.id)
        if agent is None:
            agent = HeuristicAgent({})
            runtime.agents[player.id] = agent

        payload = {
            "self_id": player.id,
            "current_phase": phase.value,
            "full_state": state.model_dump(mode="json"),
            "visible_treaties": [t.model_dump(mode="json") for t in state.treaties],
            "chat_history": [m.model_dump(mode="json") for m in state.chat[-self.settings.history_event_window :]],
            "history_log": [e.model_dump(mode="json") for e in state.log[-self.settings.history_event_window :]],
            "objectives": player.mission.model_dump(mode="json"),
            "personality": player.personality.model_dump(mode="json"),
            "adjacency": runtime.adjacency,
        }

        try:
            raw = await asyncio.wait_for(agent.take_turn(payload), timeout=self.settings.default_agent_timeout)
            bundle, error = parse_action_bundle(raw)
            if bundle is None:
                raise ValueError(error or "invalid action payload")
            return bundle
        except Exception as exc:
            event = make_event(
                "agent_fallback",
                {"player": player.id, "phase": phase.value, "error": str(exc)},
            )
            self._append_event(runtime, event)
            await self.broadcast_event(state.game_id, event.model_dump(mode="json"))
            return ActionBundle()

    async def _apply_bundle(self, runtime: GameRuntime, player: Player, bundle: ActionBundle, phase: Phase) -> None:
        state = runtime.state

        for chat in bundle.chat:
            message = ChatMessage(
                id=new_id("m"),
                ts=time.time(),
                from_player=player.id,
                to_player=chat.to_player,
                channel=chat.channel,
                text=chat.message.strip()[:400],
            )
            state.chat.append(message)
            event = make_event("chat", message.model_dump(mode="json"))
            self._append_event(runtime, event)
            await self.broadcast_event(state.game_id, event.model_dump(mode="json"))

        if bundle.treaty_offer:
            target = self._player(state, bundle.treaty_offer.target_player)
            if target.alive and target.id != player.id:
                offer = treaties.create_offer(
                    state,
                    from_player=player.id,
                    to_player=target.id,
                    treaty_type=bundle.treaty_offer.type,
                    duration_turns=bundle.treaty_offer.duration_turns,
                )
                event = make_event("treaty_offer", offer.model_dump(mode="json"))
                self._append_event(runtime, event)
                await self.broadcast_event(state.game_id, event.model_dump(mode="json"))

        if bundle.treaty_response:
            offer, treaty = treaties.respond_offer(state, bundle.treaty_response.offer_id, bundle.treaty_response.accept)
            if offer:
                event_type = "treaty_accept" if treaty else "treaty_reject"
                payload = {"offer": offer.model_dump(mode="json")}
                if treaty:
                    payload["treaty"] = treaty.model_dump(mode="json")
                event = make_event(event_type, payload)
                self._append_event(runtime, event)
                await self.broadcast_event(state.game_id, event.model_dump(mode="json"))

        if bundle.break_treaty:
            treaty = treaties.break_treaty(state, bundle.break_treaty.treaty_id, player.id)
            if treaty:
                player.reputation = max(0.0, player.reputation - 0.2)
                event = make_event(
                    "treaty_break",
                    {
                        "by": player.id,
                        "treaty": treaty.model_dump(mode="json"),
                        "new_reputation": player.reputation,
                    },
                )
                self._append_event(runtime, event)
                await self.broadcast_event(state.game_id, event.model_dump(mode="json"))

        actions = filter_actions_for_phase(bundle, phase)
        if not actions:
            event = make_event("auto_pass", {"player": player.id, "phase": phase.value})
            self._append_event(runtime, event)
            await self.broadcast_event(state.game_id, event.model_dump(mode="json"))

        fortify_done = False
        for action in actions:
            before_events = len(state.log)
            try:
                if action.type == "reinforce":
                    self._action_reinforce(runtime, player, action.territory or "", action.units or 0)
                elif action.type == "attack":
                    self._action_attack(
                        runtime,
                        player,
                        action.from_territory or "",
                        action.to_territory or "",
                        action.dice or 1,
                    )
                elif action.type == "fortify":
                    if fortify_done:
                        continue
                    self._action_fortify(
                        runtime,
                        player,
                        action.from_territory or "",
                        action.to_territory or "",
                        action.units or 0,
                    )
                    fortify_done = True
                elif action.type == "trade_cards":
                    self._action_trade_cards(runtime, player, action.cards or [])
                elif action.type == "exchange_card":
                    self._action_exchange_card(runtime, player, action.target_player or "", action.card_id or "")
                for event in state.log[before_events:]:
                    await self.broadcast_event(state.game_id, event.model_dump(mode="json"))
            except Exception as exc:
                event = make_event(
                    "invalid_action",
                    {
                        "player": player.id,
                        "phase": phase.value,
                        "action": action.model_dump(mode="json"),
                        "error": str(exc),
                    },
                )
                self._append_event(runtime, event)
                await self.broadcast_event(state.game_id, event.model_dump(mode="json"))

        if phase == Phase.REINFORCE and player.armies_in_hand > 0:
            owned = rules.owned_territories(state, player.id)
            if owned:
                target = max(owned, key=lambda territory_id: state.territories[territory_id].armies)
                extra = player.armies_in_hand
                state.territories[target].armies += extra
                player.armies_in_hand = 0
                event = make_event("reinforce", {"player": player.id, "territory": target, "units": extra, "auto": True})
                self._append_event(runtime, event)
                await self.broadcast_event(state.game_id, event.model_dump(mode="json"))

    def _action_reinforce(self, runtime: GameRuntime, player: Player, territory_id: str, units: int) -> None:
        state = runtime.state
        if units <= 0:
            raise ValueError("units must be positive")
        territory = state.territories.get(territory_id)
        if not territory:
            raise ValueError("unknown territory")
        if territory.owner != player.id:
            raise ValueError("cannot reinforce enemy territory")
        if units > player.armies_in_hand:
            raise ValueError("not enough armies in hand")

        territory.armies += units
        player.armies_in_hand -= units
        event = make_event("reinforce", {"player": player.id, "territory": territory_id, "units": units})
        self._append_event(runtime, event)

    def _action_trade_cards(self, runtime: GameRuntime, player: Player, card_ids: list[str]) -> None:
        state = runtime.state
        if not cards.is_valid_set(card_ids):
            raise ValueError("invalid trade set")
        for card_id in card_ids:
            if card_id not in player.cards:
                raise ValueError("player does not own card")
        for card_id in card_ids:
            player.cards.remove(card_id)
            state.discard.append(card_id)
        value = cards.consume_trade_value(state)
        player.armies_in_hand += value
        event = make_event("trade", {"player": player.id, "cards": card_ids, "value": value})
        self._append_event(runtime, event)

    def _action_exchange_card(self, runtime: GameRuntime, player: Player, target_player_id: str, card_id: str) -> None:
        state = runtime.state
        if card_id not in player.cards:
            raise ValueError("card not owned")
        if not treaties.has_treaty(state, player.id, target_player_id, TreatyType.TRADE):
            raise ValueError("trade treaty required")
        target = self._player(state, target_player_id)
        if not target.alive:
            raise ValueError("target not alive")
        player.cards.remove(card_id)
        target.cards.append(card_id)
        event = make_event("trade", {"from": player.id, "to": target.id, "card": card_id})
        self._append_event(runtime, event)

    def _action_attack(self, runtime: GameRuntime, player: Player, from_territory: str, to_territory: str, dice: int) -> None:
        state = runtime.state
        source = state.territories.get(from_territory)
        target = state.territories.get(to_territory)
        if source is None or target is None:
            raise ValueError("unknown territory")
        if source.owner != player.id:
            raise ValueError("origin must be owned")
        if source.armies < 2:
            raise ValueError("need at least 2 armies to attack")
        if target.owner == player.id:
            raise ValueError("cannot attack own territory")
        if not rules.is_adjacent(runtime.adjacency, from_territory, to_territory):
            raise ValueError("territories are not adjacent")
        if treaties.has_treaty(state, player.id, target.owner, TreatyType.NON_AGGRESSION):
            raise ValueError("non aggression treaty blocks attack")

        result = rules.resolve_attack(runtime.rng, source.armies, target.armies, dice)
        source.armies -= result["attacker_losses"]
        target.armies -= result["defender_losses"]

        conquered = False
        previous_owner = target.owner
        if target.armies <= 0:
            conquered = True
            move = max(1, min(result["attacker_dice"], source.armies - 1))
            source.armies -= move
            target.owner = player.id
            target.armies = move
            state.conquered_this_turn = True

            if not rules.owned_territories(state, previous_owner):
                defeated = self._player(state, previous_owner)
                defeated.alive = False
                runtime.eliminated_by[defeated.id] = player.id
                player.cards.extend(defeated.cards)
                defeated.cards = []
                eliminated_event = make_event("elimination", {"player": defeated.id, "by": player.id})
                self._append_event(runtime, eliminated_event)

        event = make_event(
            "attack",
            {
                "attacker": player.id,
                "from": from_territory,
                "to": to_territory,
                "defender": previous_owner,
                "result": result,
                "conquered": conquered,
                "source_armies": source.armies,
                "target_armies": target.armies,
            },
        )
        self._append_event(runtime, event)

    def _action_fortify(self, runtime: GameRuntime, player: Player, from_territory: str, to_territory: str, units: int) -> None:
        state = runtime.state
        if units <= 0:
            raise ValueError("units must be positive")
        source = state.territories.get(from_territory)
        target = state.territories.get(to_territory)
        if source is None or target is None:
            raise ValueError("unknown territory")
        if source.owner != player.id or target.owner != player.id:
            raise ValueError("can only fortify owned territories")
        if source.armies - units < 1:
            raise ValueError("must leave one unit behind")
        if not rules.can_fortify_connected(state, runtime.adjacency, player.id, from_territory, to_territory):
            raise ValueError("territories are not connected")

        source.armies -= units
        target.armies += units
        event = make_event("fortify", {"player": player.id, "from": from_territory, "to": to_territory, "units": units})
        self._append_event(runtime, event)

    def _check_victory(self, runtime: GameRuntime) -> Player | None:
        state = runtime.state
        alive = self._alive_players(state)
        if len(alive) == 1:
            return alive[0]

        for player in alive:
            if missions.mission_complete(player, state, runtime.continents, runtime.eliminated_by):
                return player
        return None


game_manager = GameManager()
