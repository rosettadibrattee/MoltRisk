from __future__ import annotations

from app.core.state import GameState, Treaty, TreatyOffer, TreatyType
from app.util.ids import new_id


def has_treaty(state: GameState, player_a: str, player_b: str, treaty_type: TreatyType) -> bool:
    for treaty in state.treaties:
        if treaty.type != treaty_type:
            continue
        members = set(treaty.players)
        if {player_a, player_b} == members:
            return True
    return False


def create_offer(
    state: GameState,
    from_player: str,
    to_player: str,
    treaty_type: TreatyType,
    duration_turns: int,
) -> TreatyOffer:
    offer = TreatyOffer(
        id=new_id("offer"),
        from_player=from_player,
        to_player=to_player,
        type=treaty_type,
        duration_turns=max(1, duration_turns),
        created_turn=state.turn,
    )
    state.pending_treaty_offers.append(offer)
    return offer


def respond_offer(state: GameState, offer_id: str, accept: bool) -> tuple[TreatyOffer | None, Treaty | None]:
    offer = next((candidate for candidate in state.pending_treaty_offers if candidate.id == offer_id), None)
    if offer is None:
        return None, None

    state.pending_treaty_offers = [candidate for candidate in state.pending_treaty_offers if candidate.id != offer_id]
    if not accept:
        return offer, None

    treaty = Treaty(
        id=new_id("t"),
        type=offer.type,
        players=[offer.from_player, offer.to_player],
        expires_turn=state.turn + offer.duration_turns,
        created_turn=state.turn,
    )
    state.treaties.append(treaty)
    return offer, treaty


def break_treaty(state: GameState, treaty_id: str, by_player: str) -> Treaty | None:
    treaty = next((candidate for candidate in state.treaties if candidate.id == treaty_id), None)
    if treaty is None or by_player not in treaty.players:
        return None
    state.treaties = [candidate for candidate in state.treaties if candidate.id != treaty_id]
    return treaty


def expire_treaties(state: GameState) -> list[Treaty]:
    expired = [treaty for treaty in state.treaties if treaty.expires_turn < state.turn]
    if expired:
        expired_ids = {treaty.id for treaty in expired}
        state.treaties = [treaty for treaty in state.treaties if treaty.id not in expired_ids]
    return expired
