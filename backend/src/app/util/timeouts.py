import asyncio
from typing import TypeVar

T = TypeVar("T")


async def with_timeout(coro, timeout_seconds: float, default: T) -> T:
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except Exception:
        return default
