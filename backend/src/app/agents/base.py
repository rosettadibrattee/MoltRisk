from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseAgent(ABC):
    def __init__(self, config: dict[str, Any]):
        self.config = config

    @abstractmethod
    async def take_turn(self, game_state: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    async def receive_message(self, message: dict[str, Any]) -> None:
        _ = message
