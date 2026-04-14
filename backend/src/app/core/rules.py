from __future__ import annotations
from collections import deque
from app.core.rng import GameRng
from app.core.state import GameState

def owned_territories(state: GameState, player_id: str) -> list[str]:
    return [tid for tid, t in state.territories.items() if t.owner == player_id]

def reinforcement_for_player(state: GameState, player_id: str, continents: dict[str, dict]) -> int:
    owned = owned_territories(state, player_id)
    base = max(3, len(owned) // 3)
    bonus = 0
    for c in continents.values():
        tids = c["territories"]
        if all(state.territories[t].owner == player_id for t in tids):
            bonus += int(c["bonus"])
    return base + bonus

def is_adjacent(adjacency: dict[str, list[str]], from_t: str, to_t: str) -> bool:
    return to_t in adjacency.get(from_t, [])

def can_fortify_connected(state: GameState, adjacency: dict[str, list[str]], player_id: str, from_t: str, to_t: str) -> bool:
    if from_t == to_t:
        return False
    seen: set[str] = set()
    queue: deque[str] = deque([from_t])
    while queue:
        tid = queue.popleft()
        if tid == to_t:
            return True
        for n in adjacency.get(tid, []):
            if n in seen:
                continue
            if state.territories[n].owner != player_id:
                continue
            seen.add(n)
            queue.append(n)
    return False

def resolve_attack(rng: GameRng, attacker_armies: int, defender_armies: int, requested_dice: int) -> dict:
    attacker_dice = max(1, min(3, requested_dice, attacker_armies - 1))
    defender_dice = max(1, min(2, defender_armies))
    attacker_rolls = sorted([rng.randint(1, 6) for _ in range(attacker_dice)], reverse=True)
    defender_rolls = sorted([rng.randint(1, 6) for _ in range(defender_dice)], reverse=True)
    attacker_losses = 0
    defender_losses = 0
    for a, d in zip(attacker_rolls, defender_rolls):
        if a > d:
            defender_losses += 1
        else:
            attacker_losses += 1
    return {
        "attacker_dice": attacker_dice, "defender_dice": defender_dice,
        "attacker_rolls": attacker_rolls, "defender_rolls": defender_rolls,
        "attacker_losses": attacker_losses, "defender_losses": defender_losses,
    }
