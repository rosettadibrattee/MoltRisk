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
    ActionBundle, ChatMessage, GameState, GameStatus, Phase,
    Player, PlayerKind, TerritoryState, TreatyType,
)
from app.core.validation import filter_actions_for_phase, parse_action_bundle
from app.db.repo import GameRepo
from app.settings import get_settings
from app.util.ids import new_id

COLOR_POOL = ["#e03131", "#1971c2", "#2f9e44", "#9c36b5", "#e8590c", "#0c8599", "#f08c00", "#495057"]
INITIAL_ARMIES = {2: 40, 3: 35, 4: 30, 5: 25, 6: 20, 7: 18, 8: 15}

class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, game_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._connections.setdefault(game_id, set()).add(ws)

    async def disconnect(self, game_id: str, ws: WebSocket):
        async with self._lock:
            if game_id in self._connections:
                self._connections[game_id].discard(ws)

    async def broadcast(self, game_id: str, payload: dict):
        async with self._lock:
            targets = list(self._connections.get(game_id, set()))
        dead = []
        for ws in targets:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections.get(game_id, set()).discard(ws)

@dataclass
class GameRuntime:
    state: GameState
    rng: GameRng
    adjacency: dict[str, list[str]]
    continents: dict[str, dict]
    territories: list[dict[str, str]]
    agents: dict[str, BaseAgent] = field(default_factory=dict)
    human_queues: dict[str, asyncio.Queue] = field(default_factory=dict)
    task: asyncio.Task | None = None
    eliminated_by: dict[str, str] = field(default_factory=dict)

class GameManager:
    def __init__(self):
        self.settings = get_settings()
        self.repo = GameRepo()
        self.connections = ConnectionManager()
        self.games: dict[str, GameRuntime] = {}
        self._map_cache = self._load_map("classic")

    def _load_map(self, map_id):
        base = Path(__file__).resolve().parent.parent / "maps" / map_id
        with open(base / "territories.json") as f: territories = json.load(f)
        with open(base / "continents.json") as f: continents = json.load(f)
        with open(base / "adjacency.json") as f: adjacency = json.load(f)
        return {"territories": territories, "continents": continents, "adjacency": adjacency}

    def create_game(self, map_id="classic", seed=None):
        seed = seed or random.randint(1, 999999999)
        gid = new_id("g")
        state = GameState(game_id=gid, seed=seed)
        rt = GameRuntime(state=state, rng=GameRng(seed), adjacency=self._map_cache["adjacency"], continents=self._map_cache["continents"], territories=self._map_cache["territories"])
        self.games[gid] = rt
        self.repo.create_game(state)
        return state

    def get_game(self, game_id):
        rt = self.games.get(game_id)
        if rt: return rt.state
        snap = self.repo.get_game_snapshot(game_id)
        if snap is None: raise KeyError("Game not found")
        return snap

    def add_agent_player(self, game_id, config):
        rt = self._rt(game_id)
        s = rt.state
        if s.status != GameStatus.LOBBY: raise ValueError("Cannot add after start")
        if len(s.players) >= 8: raise ValueError("Max 8 players")
        p = Player(id=new_id("p"), name=config.get("name", f"Agent {len(s.players)+1}"), kind=PlayerKind.AGENT, color=COLOR_POOL[len(s.players)%len(COLOR_POOL)], tier=config.get("tier","normal"), personality=config.get("personality",{}), mission={"type":"control_24"})
        s.players.append(p)
        prov = config.get("provider","ollama")
        if prov == "heuristic": rt.agents[p.id] = HeuristicAgent(config)
        elif prov in {"ollama","openai_compat"}: rt.agents[p.id] = LLMAgent(config)
        else: rt.agents[p.id] = HeuristicAgent(config)
        self.repo.save_state(s)
        return p

    def add_human_player(self, game_id, name):
        rt = self._rt(game_id)
        s = rt.state
        if s.status != GameStatus.LOBBY: raise ValueError("Cannot add after start")
        if len(s.players) >= 8: raise ValueError("Max 8 players")
        p = Player(id=new_id("p"), name=name, kind=PlayerKind.HUMAN, color=COLOR_POOL[len(s.players)%len(COLOR_POOL)], mission={"type":"control_24"})
        s.players.append(p)
        rt.human_queues[p.id] = asyncio.Queue()
        self.repo.save_state(s)
        return p

    async def start_game(self, game_id):
        rt = self._rt(game_id)
        s = rt.state
        if s.status != GameStatus.LOBBY: raise ValueError("Already started")
        if not 2 <= len(s.players) <= 8: raise ValueError("Need 2-8 players")
        self._init_state(rt)
        s.status = GameStatus.RUNNING
        s.current_player = s.players[0].id
        ev = make_event("system", {"message": "Game started"})
        self._add_ev(rt, ev)
        self.repo.save_state(s)
        await self._bcast_ev(game_id, ev)
        rt.task = asyncio.create_task(self._run(game_id))
        return s

    async def submit_action(self, game_id, payload):
        rt = self._rt(game_id)
        if isinstance(payload, ActionBundle): bundle, err = payload, None
        else: bundle, err = parse_action_bundle(payload)
        if err or bundle is None: return False, [err or "Invalid"], rt.state
        if rt.state.current_player is None: return False, ["No active turn"], rt.state
        p = self._player(rt.state, rt.state.current_player)
        if p.kind != PlayerKind.HUMAN: return False, ["Not human turn"], rt.state
        q = rt.human_queues.setdefault(p.id, asyncio.Queue())
        await q.put(bundle)
        return True, [], rt.state

    async def smoke_heuristic(self):
        s = self.create_game(seed=1337)
        for i in range(4):
            self.add_agent_player(s.game_id, {"name":f"Bot {i+1}","provider":"heuristic","tier":"normal","personality":{"aggression":0.5,"deception":0.2,"cooperation":0.4,"risk":0.5}})
        await self.start_game(s.game_id)
        rt = self._rt(s.game_id)
        t0 = time.time()
        while rt.state.status != GameStatus.FINISHED and rt.state.turn <= 200:
            await asyncio.sleep(0.2)
            if time.time()-t0 > 180: break
        return {"game_id":s.game_id,"status":rt.state.status,"winner":rt.state.winner,"turn":rt.state.turn,"completed":rt.state.status==GameStatus.FINISHED and rt.state.winner is not None}

    async def bcast_state(self, gid):
        rt = self._rt(gid)
        await self.connections.broadcast(gid, {"type":"state","payload":rt.state.model_dump(mode="json")})

    async def _bcast_ev(self, gid, ev):
        await self.connections.broadcast(gid, {"type":"event","payload":ev.model_dump(mode="json")})
        await self.bcast_state(gid)

    def _rt(self, gid):
        rt = self.games.get(gid)
        if rt is None: raise KeyError("Game not found")
        return rt

    def _init_state(self, rt):
        s = rt.state
        tids = [t["id"] for t in rt.territories]
        shuf = tids[:]
        rt.rng.shuffle(shuf)
        for tid in tids: s.territories[tid] = TerritoryState(owner=s.players[0].id, armies=1)
        for i, tid in enumerate(shuf): s.territories[tid] = TerritoryState(owner=s.players[i%len(s.players)].id, armies=1)
        ia = INITIAL_ARMIES[len(s.players)]
        for p in s.players:
            owned = [t for t in s.territories if s.territories[t].owner == p.id]
            rem = max(0, ia - len(owned))
            while rem > 0 and owned:
                tgt = rt.rng.choice(owned)
                s.territories[tgt].armies += 1
                rem -= 1
            p.armies_in_hand = 0; p.cards = []; p.reputation = 1.0; p.alive = True
        md = missions.build_missions([p.id for p in s.players])
        rt.rng.shuffle(md)
        for p in s.players:
            pk = md.pop(0)
            att = 0
            while pk.type == "destroy_player" and pk.target_player == p.id and md and att < 8:
                md.append(pk); pk = md.pop(0); att += 1
            p.mission = pk
        s.deck = cards.build_deck(tids)
        rt.rng.shuffle(s.deck)
        s.discard = []; s.turn = 1; s.phase = Phase.REINFORCE
        s.treaties = []; s.pending_treaty_offers = []; s.chat = []; s.log = []
        s.winner = None; s.next_trade_value = 4

    def _player(self, s, pid):
        for p in s.players:
            if p.id == pid: return p
        raise ValueError("Player not found")

    def _alive(self, s): return [p for p in s.players if p.alive]

    def _next(self, s, cid):
        alive = self._alive(s)
        if not alive: raise ValueError("No alive players")
        order = [p.id for p in s.players if p.alive]
        if cid not in order: return alive[0]
        i = order.index(cid)
        return self._player(s, order[(i+1)%len(order)])

    def _add_ev(self, rt, ev):
        rt.state.log.append(ev)
        if len(rt.state.log) > 4000: rt.state.log = rt.state.log[-4000:]
        self.repo.append_event(rt.state.game_id, rt.state.turn, ev)

    async def _run(self, gid):
        rt = self._rt(gid)
        s = rt.state
        try:
            while s.status == GameStatus.RUNNING:
                cur = self._player(s, s.current_player or s.players[0].id)
                if not cur.alive: cur = self._next(s, cur.id); s.current_player = cur.id
                s.conquered_this_turn = False
                reinf = rules.reinforcement_for_player(s, cur.id, rt.continents)
                cur.armies_in_hand += reinf
                self._add_ev(rt, make_event("reinforcement_grant",{"player":cur.id,"units":reinf}))
                await self._bcast_ev(gid, s.log[-1])
                dl = time.time() + self.settings.turn_seconds
                s.turn_deadline_ts = dl
                for ph in [Phase.REINFORCE, Phase.ATTACK, Phase.FORTIFY]:
                    s.phase = ph
                    ev = make_event("phase_change",{"turn":s.turn,"player":cur.id,"phase":ph.value})
                    self._add_ev(rt, ev); await self._bcast_ev(gid, ev)
                    bun = await self._get_bun(rt, cur, ph, dl)
                    await self._apply(rt, cur, bun, ph)
                    self.repo.save_state(s)
                    if s.status == GameStatus.FINISHED: break
                if s.status == GameStatus.FINISHED: break
                if s.conquered_this_turn and s.deck:
                    c = s.deck.pop(0); cur.cards.append(c)
                    ev = make_event("card_draw",{"player":cur.id,"card":c})
                    self._add_ev(rt, ev); await self._bcast_ev(gid, ev)
                for t in treaties.expire_treaties(s):
                    ev = make_event("treaty_expired",{"treaty":t.model_dump(mode="json")})
                    self._add_ev(rt, ev); await self._bcast_ev(gid, ev)
                w = self._check_win(rt)
                if w:
                    s.status = GameStatus.FINISHED; s.winner = w.id
                    ev = make_event("win",{"winner":w.id,"name":w.name})
                    self._add_ev(rt, ev); await self._bcast_ev(gid, ev)
                    self.repo.save_state(s); break
                nxt = self._next(s, cur.id); s.current_player = nxt.id; s.turn += 1
                ev = make_event("turn_advance",{"turn":s.turn,"current_player":s.current_player})
                self._add_ev(rt, ev); await self._bcast_ev(gid, ev)
                self.repo.save_state(s)
                if s.turn > 200:
                    leader = max(self._alive(s), key=lambda p: len(rules.owned_territories(s, p.id)))
                    s.status = GameStatus.FINISHED; s.winner = leader.id
                    ev = make_event("win",{"winner":leader.id,"name":leader.name,"reason":"turn_cap"})
                    self._add_ev(rt, ev); await self._bcast_ev(gid, ev)
                    self.repo.save_state(s); break
        except Exception as exc:
            ev = make_event("error",{"message":f"Game loop error: {exc}"})
            self._add_ev(rt, ev); await self._bcast_ev(gid, ev)
            s.status = GameStatus.FINISHED; self.repo.save_state(s)

    async def _get_bun(self, rt, player, phase, dl):
        s = rt.state
        if player.kind == PlayerKind.HUMAN:
            q = rt.human_queues.setdefault(player.id, asyncio.Queue())
            to = max(0.1, dl - time.time())
            try: return await asyncio.wait_for(q.get(), timeout=to)
            except asyncio.TimeoutError:
                self._add_ev(rt, make_event("timeout",{"player":player.id,"phase":phase.value}))
                await self._bcast_ev(s.game_id, rt.state.log[-1])
                return ActionBundle()
        agent = rt.agents.get(player.id) or HeuristicAgent({})
        if player.id not in rt.agents: rt.agents[player.id] = agent
        payload = {"self_id":player.id,"current_phase":phase.value,"full_state":s.model_dump(mode="json"),"visible_treaties":[t.model_dump(mode="json") for t in s.treaties],"chat_history":[m.model_dump(mode="json") for m in s.chat[-self.settings.history_event_window:]],"history_log":[e.model_dump(mode="json") for e in s.log[-self.settings.history_event_window:]],"objectives":player.mission.model_dump(mode="json"),"personality":player.personality.model_dump(mode="json"),"adjacency":rt.adjacency}
        try:
            raw = await asyncio.wait_for(agent.take_turn(payload), timeout=self.settings.default_agent_timeout)
            bun, err = parse_action_bundle(raw)
            if bun is None: raise ValueError(err)
            return bun
        except Exception as exc:
            self._add_ev(rt, make_event("agent_fallback",{"player":player.id,"phase":phase.value,"error":str(exc)}))
            await self._bcast_ev(s.game_id, rt.state.log[-1])
            return ActionBundle()

    async def _apply(self, rt, player, bun, phase):
        s = rt.state
        for ch in bun.chat:
            msg = ChatMessage(id=new_id("m"),ts=time.time(),from_player=player.id,to_player=ch.to_player,channel=ch.channel,text=ch.message.strip()[:400])
            s.chat.append(msg)
            ev = make_event("chat",msg.model_dump(mode="json"))
            self._add_ev(rt, ev); await self._bcast_ev(s.game_id, ev)
        if bun.treaty_offer:
            tgt = self._player(s, bun.treaty_offer.target_player)
            if tgt.alive and tgt.id != player.id:
                off = treaties.create_offer(s, player.id, tgt.id, bun.treaty_offer.type, bun.treaty_offer.duration_turns)
                ev = make_event("treaty_offer",off.model_dump(mode="json"))
                self._add_ev(rt, ev); await self._bcast_ev(s.game_id, ev)
        if bun.treaty_response:
            off, tr = treaties.respond_offer(s, bun.treaty_response.offer_id, bun.treaty_response.accept)
            if off:
                et = "treaty_accept" if tr else "treaty_reject"
                pl = {"offer":off.model_dump(mode="json")}
                if tr: pl["treaty"] = tr.model_dump(mode="json")
                ev = make_event(et, pl)
                self._add_ev(rt, ev); await self._bcast_ev(s.game_id, ev)
        if bun.break_treaty:
            tr = treaties.break_treaty(s, bun.break_treaty.treaty_id, player.id)
            if tr:
                player.reputation = max(0.0, player.reputation - 0.2)
                ev = make_event("treaty_break",{"by":player.id,"treaty":tr.model_dump(mode="json"),"new_reputation":player.reputation})
                self._add_ev(rt, ev); await self._bcast_ev(s.game_id, ev)
        acts = filter_actions_for_phase(bun, phase)
        if not acts:
            ev = make_event("auto_pass",{"player":player.id,"phase":phase.value})
            self._add_ev(rt, ev); await self._bcast_ev(s.game_id, ev)
        fort_done = False
        for a in acts:
            b4 = len(s.log)
            try:
                if a.type == "reinforce": self._do_reinforce(rt, player, a.territory or "", a.units or 0)
                elif a.type == "attack": self._do_attack(rt, player, a.from_territory or "", a.to_territory or "", a.dice or 1)
                elif a.type == "fortify":
                    if fort_done: continue
                    self._do_fortify(rt, player, a.from_territory or "", a.to_territory or "", a.units or 0)
                    fort_done = True
                elif a.type == "trade_cards": self._do_trade(rt, player, a.cards or [])
                elif a.type == "exchange_card": self._do_exchange(rt, player, a.target_player or "", a.card_id or "")
                for ev in s.log[b4:]: await self._bcast_ev(s.game_id, ev)
            except Exception as exc:
                ev = make_event("invalid_action",{"player":player.id,"phase":phase.value,"error":str(exc)})
                self._add_ev(rt, ev); await self._bcast_ev(s.game_id, ev)
        if phase == Phase.REINFORCE and player.armies_in_hand > 0:
            owned = rules.owned_territories(s, player.id)
            if owned:
                tgt = max(owned, key=lambda t: s.territories[t].armies)
                ex = player.armies_in_hand; s.territories[tgt].armies += ex; player.armies_in_hand = 0
                ev = make_event("reinforce",{"player":player.id,"territory":tgt,"units":ex,"auto":True})
                self._add_ev(rt, ev); await self._bcast_ev(s.game_id, ev)

    def _do_reinforce(self, rt, p, tid, u):
        s = rt.state
        if u <= 0: raise ValueError("units must be positive")
        t = s.territories.get(tid)
        if not t: raise ValueError("unknown territory")
        if t.owner != p.id: raise ValueError("not owned")
        if u > p.armies_in_hand: raise ValueError("not enough armies")
        t.armies += u; p.armies_in_hand -= u
        self._add_ev(rt, make_event("reinforce",{"player":p.id,"territory":tid,"units":u}))

    def _do_trade(self, rt, p, cids):
        s = rt.state
        if not cards.is_valid_set(cids): raise ValueError("invalid set")
        for c in cids:
            if c not in p.cards: raise ValueError("not owned")
        for c in cids: p.cards.remove(c); s.discard.append(c)
        v = cards.consume_trade_value(s); p.armies_in_hand += v
        self._add_ev(rt, make_event("trade",{"player":p.id,"cards":cids,"value":v}))

    def _do_exchange(self, rt, p, tid, cid):
        s = rt.state
        if cid not in p.cards: raise ValueError("not owned")
        if not treaties.has_treaty(s, p.id, tid, TreatyType.TRADE): raise ValueError("trade treaty required")
        tgt = self._player(s, tid)
        if not tgt.alive: raise ValueError("target not alive")
        p.cards.remove(cid); tgt.cards.append(cid)
        self._add_ev(rt, make_event("trade",{"from":p.id,"to":tgt.id,"card":cid}))

    def _do_attack(self, rt, p, ft, tt, dice):
        s = rt.state
        src = s.territories.get(ft); tgt = s.territories.get(tt)
        if not src or not tgt: raise ValueError("unknown territory")
        if src.owner != p.id: raise ValueError("not owned")
        if src.armies < 2: raise ValueError("need 2+ armies")
        if tgt.owner == p.id: raise ValueError("own territory")
        if not rules.is_adjacent(rt.adjacency, ft, tt): raise ValueError("not adjacent")
        if treaties.has_treaty(s, p.id, tgt.owner, TreatyType.NON_AGGRESSION): raise ValueError("NAP blocks")
        res = rules.resolve_attack(rt.rng, src.armies, tgt.armies, dice)
        src.armies -= res["attacker_losses"]; tgt.armies -= res["defender_losses"]
        conq = False; prev = tgt.owner
        if tgt.armies <= 0:
            conq = True
            mv = max(1, min(res["attacker_dice"], src.armies - 1))
            src.armies -= mv; tgt.owner = p.id; tgt.armies = mv; s.conquered_this_turn = True
            if not rules.owned_territories(s, prev):
                d = self._player(s, prev); d.alive = False
                rt.eliminated_by[d.id] = p.id; p.cards.extend(d.cards); d.cards = []
                self._add_ev(rt, make_event("elimination",{"player":d.id,"by":p.id}))
        self._add_ev(rt, make_event("attack",{"attacker":p.id,"from":ft,"to":tt,"defender":prev,"result":res,"conquered":conq,"source_armies":src.armies,"target_armies":tgt.armies}))

    def _do_fortify(self, rt, p, ft, tt, u):
        s = rt.state
        if u <= 0: raise ValueError("units positive")
        src = s.territories.get(ft); tgt = s.territories.get(tt)
        if not src or not tgt: raise ValueError("unknown")
        if src.owner != p.id or tgt.owner != p.id: raise ValueError("not owned")
        if src.armies - u < 1: raise ValueError("leave 1")
        if not rules.can_fortify_connected(s, rt.adjacency, p.id, ft, tt): raise ValueError("not connected")
        src.armies -= u; tgt.armies += u
        self._add_ev(rt, make_event("fortify",{"player":p.id,"from":ft,"to":tt,"units":u}))

    def _check_win(self, rt):
        s = rt.state
        alive = self._alive(s)
        if len(alive) == 1: return alive[0]
        for p in alive:
            if missions.mission_complete(p, s, rt.continents, rt.eliminated_by): return p
        return None

game_manager = GameManager()
