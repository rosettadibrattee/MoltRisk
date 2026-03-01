from __future__ import annotations

from pydantic import ValidationError

from app.core.state import ActionBundle, Phase


def parse_action_bundle(payload: dict | str | None) -> tuple[ActionBundle | None, str | None]:
    if payload is None:
        return ActionBundle(), None
    try:
        if isinstance(payload, str):
            import json

            payload = json.loads(payload)
        return ActionBundle.model_validate(payload), None
    except (ValidationError, ValueError) as exc:
        return None, str(exc)


def filter_actions_for_phase(bundle: ActionBundle, phase: Phase):
    if phase == Phase.REINFORCE:
        return [action for action in bundle.phase_actions if action.type in {"reinforce", "trade_cards", "exchange_card"}]
    if phase == Phase.ATTACK:
        return [action for action in bundle.phase_actions if action.type == "attack"]
    if phase == Phase.FORTIFY:
        return [action for action in bundle.phase_actions if action.type == "fortify"]
    return []
