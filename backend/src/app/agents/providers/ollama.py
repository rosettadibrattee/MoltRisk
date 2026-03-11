from __future__ import annotations
import httpx

async def complete_chat(endpoint: str, model: str, messages: list[dict], timeout: float = 30.0) -> str:
    url = endpoint.rstrip("/") + "/api/chat"
    payload = {"model": model, "messages": messages, "stream": False, "format": "json"}
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        return r.json().get("message", {}).get("content", "")
