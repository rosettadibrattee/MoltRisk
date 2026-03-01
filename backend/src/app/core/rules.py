from __future__ import annotations

from collections import deque

from app.core.rng import GameRng
from app.core.state import GameState


def owned_territories(state: GameState, player_id: str) -> list[str]:
    return [territory_id for territory_id, territory in state.territories.items() if territory.owner == player_id]


def reinforcement_for_player(
    state: GameState,
    player_id: str,
    continents: dict[str, dict],
) -> int:
    owned = owned_territories(state, player_id)
    base = max(3, len(owned) // 3)
    bonus = 0
    for continent in continents.values():
        territory_ids = continent["territories"]
        if all(state.territories[territory_id].owner == player_id for territory_id in territory_ids):
            bonus += int(continent["bonus"])
    return base + bonus


def is_adjacent(adjacency: dict[str, list[str]], from_territory: str, to_territory: str) -> bool:
    return to_territory in adjacency.get(from_territory, [])


def can_fortify_connected(
    state: GameState,
    adjacency: dict[str, list[str]],
    player_id: str,
    from_territory: str,
    to_territory: str,
) -> bool:
    if from_territory == to_territory:
        return False

    seen: set[str] = set()
    queue: deque[str] = deque([from_territory])
    while queue:
        territory_id = queue.popleft()
        if territory_id == to_territory:
            return True
        for neighbor in adjacency.get(territory_id, []):
            if neighbor in seen:
                continue
            if state.territories[neighbor].owner != player_id:
                continue
            seen.add(neighbor)
            queue.append(neighbor)
    return False


def resolve_attack(
    rng: GameRng,
    attacker_armies: int,
    defender_armies: int,
    requested_dice: int,
) -> dict:
    attacker_dice = max(1, min(3, requested_dice, attacker_armies - 1))
    defender_dice = max(1, min(2, defender_armies))

    attacker_rolls = sorted([rng.randint(1, 6) for _ in range(attacker_dice)], reverse=True)
    defender_rolls = sorted([rng.randint(1, 6) for _ in range(defender_dice)], reverse=True)

    attacker_losses = 0
    defender_losses = 0
    for attack_roll, defend_roll in zip(attacker_rolls, defender_rolls):
        if attack_roll > defend_roll:
            defender_losses += 1
        else:
            attacker_losses += 1

    return {
        "attacker_dice": attacker_dice,
        "defender_dice": defender_dice,
        "attacker_rolls": attacker_rolls,
        "defender_rolls": defender_rolls,
        "attacker_losses": attacker_losses,
        "defender_losses": defender_losses,
    }
