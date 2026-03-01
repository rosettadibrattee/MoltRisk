import time
from typing import Any

from app.core.state import GameEvent
from app.util.ids import new_id


def make_event(event_type: str, data: dict[str, Any]) -> GameEvent:
    return GameEvent(id=new_id("e"), ts=time.time(), type=event_type, data=data)
