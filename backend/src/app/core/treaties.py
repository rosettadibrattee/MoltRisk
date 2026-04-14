from __future__ import annotations
from app.core.state import GameState, Treaty, TreatyOffer, TreatyType
from app.util.ids import new_id

def has_treaty(state: GameState, a: str, b: str, treaty_type: TreatyType) -> bool:
    for t in state.treaties:
        if t.type == treaty_type and set(t.players) == {a, b}:
            return True
    return False

def create_offer(state: GameState, from_player: str, to_player: str, treaty_type: TreatyType, duration_turns: int) -> TreatyOffer:
    offer = TreatyOffer(id=new_id("offer"), from_player=from_player, to_player=to_player,
                        type=treaty_type, duration_turns=max(1, duration_turns), created_turn=state.turn)
    state.pending_treaty_offers.append(offer)
    return offer

def respond_offer(state: GameState, offer_id: str, accept: bool) -> tuple[TreatyOffer | None, Treaty | None]:
    offer = next((o for o in state.pending_treaty_offers if o.id == offer_id), None)
    if offer is None:
        return None, None
    state.pending_treaty_offers = [o for o in state.pending_treaty_offers if o.id != offer_id]
    if not accept:
        return offer, None
    treaty = Treaty(id=new_id("t"), type=offer.type, players=[offer.from_player, offer.to_player],
                    expires_turn=state.turn + offer.duration_turns, created_turn=state.turn)
    state.treaties.append(treaty)
    return offer, treaty

def break_treaty(state: GameState, treaty_id: str, by_player: str) -> Treaty | None:
    treaty = next((t for t in state.treaties if t.id == treaty_id), None)
    if treaty is None or by_player not in treaty.players:
        return None
    state.treaties = [t for t in state.treaties if t.id != treaty_id]
    return treaty

def expire_treaties(state: GameState) -> list[Treaty]:
    expired = [t for t in state.treaties if t.expires_turn < state.turn]
    if expired:
        ids = {t.id for t in expired}
        state.treaties = [t for t in state.treaties if t.id not in ids]
    return expired
