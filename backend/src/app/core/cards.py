from __future__ import annotations

from app.core.state import GameState

SYMBOLS = ["infantry", "cavalry", "artillery"]


def build_deck(territory_ids: list[str]) -> list[str]:
    deck: list[str] = []
    for idx, territory_id in enumerate(territory_ids):
        symbol = SYMBOLS[idx % len(SYMBOLS)]
        deck.append(f"{territory_id}:{symbol}")
    deck.extend(["wild:wild", "wild:wild"])
    return deck


def card_symbol(card_id: str) -> str:
    return card_id.split(":", 1)[1]


def is_valid_set(cards: list[str]) -> bool:
    if len(cards) != 3:
        return False
    symbols = [card_symbol(card) for card in cards]
    wild_count = symbols.count("wild")
    non_wild = [s for s in symbols if s != "wild"]
    if wild_count:
        return True
    unique = set(non_wild)
    return len(unique) == 1 or len(unique) == 3


def consume_trade_value(state: GameState) -> int:
    current = state.next_trade_value
    if current < 15:
        state.next_trade_value += 2 if current < 12 else 3
    else:
        state.next_trade_value += 5
    return current
