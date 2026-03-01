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
    for player_id in player_ids:
        missions.append(Mission(type="destroy_player", target_player=player_id))
    return missions


def _owned_territories(state: GameState, player_id: str) -> list[tuple[str, int]]:
    return [
        (territory_id, territory.armies)
        for territory_id, territory in state.territories.items()
        if territory.owner == player_id
    ]


def _controls_continent(state: GameState, player_id: str, continent_territories: list[str]) -> bool:
    return all(state.territories[t].owner == player_id for t in continent_territories)


def mission_complete(
    player: Player,
    state: GameState,
    continents: dict[str, dict],
    eliminated_by: dict[str, str],
) -> bool:
    mission = player.mission
    owned = _owned_territories(state, player.id)

    if mission.type == "control_24":
        return len(owned) >= 24

    if mission.type == "control_18_two_armies":
        with_two = [territory for territory in owned if territory[1] >= 2]
        return len(with_two) >= 18

    if mission.type == "control_continents":
        if not mission.continents:
            return False
        return all(
            _controls_continent(state, player.id, continents[continent_id]["territories"])
            for continent_id in mission.continents
        )

    if mission.type == "destroy_player":
        target_id = mission.target_player
        if not target_id:
            return False
        target_player = next((candidate for candidate in state.players if candidate.id == target_id), None)
        if not target_player:
            return len(owned) >= 24
        if target_player.alive:
            return False
        if eliminated_by.get(target_id) == player.id:
            return True
        player.mission = Mission(type="control_24")
        return len(owned) >= 24

    return False
