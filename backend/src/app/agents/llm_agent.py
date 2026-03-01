from __future__ import annotations

import json
from typing import Any

from app.agents.base import BaseAgent
from app.agents.providers import ollama, openai_compat


def _strip_markdown_fences(content: str) -> str:
    stripped = content.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if len(lines) >= 3:
            stripped = "\n".join(lines[1:-1]).strip()
    return stripped


class LLMAgent(BaseAgent):
    async def take_turn(self, game_state: dict[str, Any]) -> dict[str, Any]:
        provider = self.config.get("provider", "ollama")
        model = self.config.get("model", "llama3.1:8b")
        endpoint = self.config.get("endpoint", "http://ollama:11434")
        api_key = self.config.get("api_key")
        tier = self.config.get("tier", "normal")
        personality = self.config.get("personality", {})

        system_prompt = (
            "You are a Risk player. Output strict JSON only, matching this schema: "
            '{"phase_actions":[],"chat":[],"treaty_offer":null,"treaty_response":null,"break_treaty":null}. '
            "No markdown or prose. Respect non-aggression treaties."
        )
        user_prompt = {
            "tier": tier,
            "personality": personality,
            "self_id": game_state["self_id"],
            "current_phase": game_state["current_phase"],
            "mission": game_state["objectives"],
            "treaties": game_state["visible_treaties"],
            "history_log": game_state["history_log"],
            "chat_history": game_state["chat_history"],
            "full_state": game_state["full_state"],
        }

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_prompt)},
        ]

        if provider == "ollama":
            raw = await ollama.complete_chat(endpoint=endpoint, model=model, messages=messages)
        else:
            raw = await openai_compat.complete_chat(
                endpoint=endpoint,
                model=model,
                messages=messages,
                api_key=api_key,
            )

        cleaned = _strip_markdown_fences(raw)
        parsed = json.loads(cleaned)
        if not isinstance(parsed, dict):
            raise ValueError("LLM output is not a JSON object")
        return parsed
