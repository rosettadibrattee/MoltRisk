from __future__ import annotations
from app.agents.base import BaseAgent

class HeuristicAgent(BaseAgent):
    async def take_turn(self, game_state: dict) -> dict:
        self_id = game_state["self_id"]
        phase = game_state["current_phase"]
        full_state = game_state["full_state"]
        territories = full_state["territories"]
        adjacency = game_state["adjacency"]
        mine = [t for t, d in territories.items() if d["owner"] == self_id]
        actions = []
        if phase == "reinforce":
            armies = next(p for p in full_state["players"] if p["id"] == self_id)["armies_in_hand"]
            if mine and armies > 0:
                frontline = [t for t in mine if any(territories[n]["owner"] != self_id for n in adjacency[t])]
                target = max(frontline or mine, key=lambda t: territories[t]["armies"])
                actions.append({"type": "reinforce", "territory": target, "units": armies})
        elif phase == "attack":
            for t in mine:
                a = territories[t]["armies"]
                if a < 3: continue
                for n in adjacency[t]:
                    if territories[n]["owner"] == self_id: continue
                    if a >= territories[n]["armies"] + 2:
                        actions.append({"type": "attack", "from_territory": t, "to_territory": n, "dice": min(3, a - 1)})
                        if len(actions) >= 3: break
                if len(actions) >= 3: break
        elif phase == "fortify":
            border = [t for t in mine if any(territories[n]["owner"] != self_id for n in adjacency[t])]
            safe = [t for t in mine if all(territories[n]["owner"] == self_id for n in adjacency[t])]
            src = next((t for t in safe if territories[t]["armies"] > 1), None)
            tgt = border[0] if border else None
            if src and tgt and src != tgt:
                actions.append({"type": "fortify", "from_territory": src, "to_territory": tgt, "units": 1})
        return {"phase_actions": actions, "chat": []}
