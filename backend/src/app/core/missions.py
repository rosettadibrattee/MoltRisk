from __future__ import annotations
from app.core.state import GameState, Mission, Player


def build_missions(player_ids: list[str]) -> list[Mission]:
    missions: list[Mission] = [
        Mission(type="control_24"),
        Mission(type="control_18_two_armies"),
        Mission(type="control_continents", continents=["north_america", "africa"]),
        Mission(type="control_continents", continents=["europe", "south_america"]),
        Mission(type="control_continents", continents=["asia", "south_america"]),
        Mission(type="control_continents", continents=["europe", "australia"]),
    ]
    for pid in player_ids:
        missions.append(Mission(type="destroy_player", target_player=pid))
    return missions


def _owned_territories(state: GameState, player_id: str) -> list[tuple[str, int]]:
    return [(tid, t.armies) for tid, t in state.territories.items() if t.owner == player_id]


def _controls_continent(state: GameState, player_id: str, continent_territories: list[str]) -> bool:
    return all(state.territories[t].owner == player_id for t in continent_territories)


def mission_complete(player: Player, state: GameState, continents: dict[str, dict], eliminated_by: dict[str, str]) -> bool:
    mission = player.mission
    owned = _owned_territories(state, player.id)
    if mission.type == "control_24":
        return len(owned) >= 24
    if mission.type == "control_18_two_armies":
        with_two = [t for t in owned if t[1] >= 2]
        return len(with_two) >= 18
    if mission.type == "control_continents":
        if not mission.continents:
            return False
        return all(_controls_continent(state, player.id, continents[cid]["territories"]) for cid in mission.continents)
    if mission.type == "destroy_player":
        target_id = mission.target_player
        if not target_id:
            return False
        target = next((p for p in state.players if p.id == target_id), None)
        if not target:
            return len(owned) >= 24
        if target.alive:
            return False
        if eliminated_by.get(target_id) == player.id:
            return True
        player.mission = Mission(type="control_24")
        return len(owned) >= 24
    return False
