from __future__ import annotations

from app.agents.base import BaseAgent


class HeuristicAgent(BaseAgent):
    async def take_turn(self, game_state: dict) -> dict:
        self_id = game_state["self_id"]
        phase = game_state["current_phase"]
        full_state = game_state["full_state"]
        territories = full_state["territories"]
        adjacency = game_state["adjacency"]

        mine = [t for t, data in territories.items() if data["owner"] == self_id]
        actions = []

        if phase == "reinforce":
            armies_in_hand = next(player for player in full_state["players"] if player["id"] == self_id)["armies_in_hand"]
            if mine and armies_in_hand > 0:
                frontline = []
                for territory_id in mine:
                    if any(territories[n]["owner"] != self_id for n in adjacency[territory_id]):
                        frontline.append(territory_id)
                target = max(frontline or mine, key=lambda territory_id: territories[territory_id]["armies"])
                actions.append({"type": "reinforce", "territory": target, "units": armies_in_hand})

        elif phase == "attack":
            for territory_id in mine:
                armies = territories[territory_id]["armies"]
                if armies < 3:
                    continue
                for neighbor in adjacency[territory_id]:
                    if territories[neighbor]["owner"] == self_id:
                        continue
                    defender_armies = territories[neighbor]["armies"]
                    if armies >= defender_armies + 2:
                        actions.append(
                            {
                                "type": "attack",
                                "from_territory": territory_id,
                                "to_territory": neighbor,
                                "dice": min(3, armies - 1),
                            }
                        )
                        if len(actions) >= 3:
                            break
                if len(actions) >= 3:
                    break

        elif phase == "fortify":
            border = []
            safe = []
            for territory_id in mine:
                if any(territories[n]["owner"] != self_id for n in adjacency[territory_id]):
                    border.append(territory_id)
                else:
                    safe.append(territory_id)

            source = next((territory_id for territory_id in safe if territories[territory_id]["armies"] > 1), None)
            target = border[0] if border else None
            if source and target and source != target:
                actions.append({"type": "fortify", "from_territory": source, "to_territory": target, "units": 1})

        return {"phase_actions": actions, "chat": []}
