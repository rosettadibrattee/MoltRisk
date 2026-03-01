from __future__ import annotations

import httpx


async def complete_chat(endpoint: str, model: str, messages: list[dict], timeout: float = 30.0) -> str:
    url = endpoint.rstrip("/") + "/api/chat"
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "format": "json",
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
    message = data.get("message", {})
    return message.get("content", "")
