from __future__ import annotations
import json
from app.core.state import ChatMessage, GameEvent, GameState, Player, Treaty
from app.db.models import ActionLogModel, ChatMessageModel, GameModel, PlayerModel, TerritoryModel, TreatyModel
from app.db.session import get_session

class GameRepo:
    def create_game(self, state: GameState) -> None:
        with get_session() as session:
            session.add(GameModel(id=state.game_id, seed=state.seed, status=state.status.value, state_json=state.model_dump_json()))
            session.commit()

    def save_state(self, state: GameState) -> None:
        with get_session() as session:
            game = session.get(GameModel, state.game_id)
            if game is None:
                game = GameModel(id=state.game_id, seed=state.seed, status=state.status.value)
                session.add(game)
            game.status = state.status.value
            game.state_json = state.model_dump_json()
            session.query(PlayerModel).filter(PlayerModel.game_id == state.game_id).delete()
            for p in state.players:
                session.add(PlayerModel(id=p.id, game_id=state.game_id, type=p.kind.value, name=p.name, reputation=p.reputation, personality_json=p.personality.model_dump_json(), alive=p.alive))
            session.query(TerritoryModel).filter(TerritoryModel.game_id == state.game_id).delete()
            for tid, t in state.territories.items():
                session.add(TerritoryModel(id=f"{state.game_id}:{tid}", game_id=state.game_id, owner_id=t.owner, army_count=t.armies))
            session.query(TreatyModel).filter(TreatyModel.game_id == state.game_id).delete()
            for tr in state.treaties:
                session.add(TreatyModel(id=tr.id, game_id=state.game_id, type=tr.type.value, players_json=json.dumps(tr.players), expires_turn=tr.expires_turn))
            session.query(ChatMessageModel).filter(ChatMessageModel.game_id == state.game_id).delete()
            for m in state.chat[-500:]:
                from datetime import datetime
                session.add(ChatMessageModel(id=m.id, game_id=state.game_id, sender_id=m.from_player, receiver_id=m.to_player, channel=m.channel, message=m.text, timestamp=datetime.utcfromtimestamp(m.ts)))
            session.query(ActionLogModel).filter(ActionLogModel.game_id == state.game_id).delete()
            for e in state.log[-2000:]:
                from datetime import datetime
                session.add(ActionLogModel(id=e.id, game_id=state.game_id, turn=state.turn, event_json=e.model_dump_json(), timestamp=datetime.utcfromtimestamp(e.ts)))
            session.commit()

    def get_game_snapshot(self, game_id: str) -> GameState | None:
        with get_session() as session:
            game = session.get(GameModel, game_id)
            if game is None:
                return None
            return GameState.model_validate_json(game.state_json)

    def append_event(self, game_id: str, turn: int, event: GameEvent) -> None:
        with get_session() as session:
            from datetime import datetime
            session.add(ActionLogModel(id=event.id, game_id=game_id, turn=turn, event_json=event.model_dump_json(), timestamp=datetime.utcfromtimestamp(event.ts)))
            session.commit()
