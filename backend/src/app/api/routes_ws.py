from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.engine import game_manager

router = APIRouter(tags=["ws"])


@router.websocket("/ws/games/{game_id}")
async def game_socket(websocket: WebSocket, game_id: str):
    await game_manager.connections.connect(game_id, websocket)
    try:
        state = game_manager.get_game(game_id)
        await websocket.send_json({"type": "state", "payload": state.model_dump(mode="json")})
        while True:
            # Keep alive / optional incoming messages from UI.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await game_manager.connections.disconnect(game_id, websocket)
    except Exception:
        await game_manager.connections.disconnect(game_id, websocket)
