from __future__ import annotations

import json

from app.core.state import ChatMessage, GameEvent, GameState, Player, TerritoryState, Treaty
from app.db.models import ActionLogModel, ChatMessageModel, GameModel, PlayerModel, TerritoryModel, TreatyModel
from app.db.session import get_session


class GameRepo:
    def create_game(self, state: GameState) -> None:
        with get_session() as session:
            session.add(
                GameModel(
                    id=state.game_id,
                    seed=state.seed,
                    status=state.status.value,
                    state_json=state.model_dump_json(),
                )
            )
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
            for player in state.players:
                session.add(self._player_model(state.game_id, player))

            session.query(TerritoryModel).filter(TerritoryModel.game_id == state.game_id).delete()
            for territory_id, territory in state.territories.items():
                session.add(
                    TerritoryModel(
                        id=f"{state.game_id}:{territory_id}",
                        game_id=state.game_id,
                        owner_id=territory.owner,
                        army_count=territory.armies,
                    )
                )

            session.query(TreatyModel).filter(TreatyModel.game_id == state.game_id).delete()
            for treaty in state.treaties:
                session.add(self._treaty_model(state.game_id, treaty))

            session.query(ChatMessageModel).filter(ChatMessageModel.game_id == state.game_id).delete()
            for message in state.chat[-500:]:
                session.add(self._chat_model(state.game_id, message))

            session.query(ActionLogModel).filter(ActionLogModel.game_id == state.game_id).delete()
            for event in state.log[-2000:]:
                session.add(self._event_model(state.game_id, state.turn, event))

            session.commit()

    def get_game_snapshot(self, game_id: str) -> GameState | None:
        with get_session() as session:
            game = session.get(GameModel, game_id)
            if game is None:
                return None
            return GameState.model_validate_json(game.state_json)

    def append_event(self, game_id: str, turn: int, event: GameEvent) -> None:
        with get_session() as session:
            session.add(self._event_model(game_id, turn, event))
            session.commit()

    @staticmethod
    def _player_model(game_id: str, player: Player) -> PlayerModel:
        return PlayerModel(
            id=player.id,
            game_id=game_id,
            type=player.kind.value,
            name=player.name,
            reputation=player.reputation,
            personality_json=player.personality.model_dump_json(),
            alive=player.alive,
        )

    @staticmethod
    def _treaty_model(game_id: str, treaty: Treaty) -> TreatyModel:
        return TreatyModel(
            id=treaty.id,
            game_id=game_id,
            type=treaty.type.value,
            players_json=json.dumps(treaty.players),
            expires_turn=treaty.expires_turn,
        )

    @staticmethod
    def _chat_model(game_id: str, message: ChatMessage) -> ChatMessageModel:
        from datetime import datetime

        return ChatMessageModel(
            id=message.id,
            game_id=game_id,
            sender_id=message.from_player,
            receiver_id=message.to_player,
            channel=message.channel,
            message=message.text,
            timestamp=datetime.utcfromtimestamp(message.ts),
        )

    @staticmethod
    def _event_model(game_id: str, turn: int, event: GameEvent) -> ActionLogModel:
        from datetime import datetime

        return ActionLogModel(
            id=event.id,
            game_id=game_id,
            turn=turn,
            event_json=event.model_dump_json(),
            timestamp=datetime.utcfromtimestamp(event.ts),
        )
