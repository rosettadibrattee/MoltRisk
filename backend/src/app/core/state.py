from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class GameStatus(str, Enum):
    LOBBY = "lobby"
    RUNNING = "running"
    FINISHED = "finished"


class Phase(str, Enum):
    REINFORCE = "reinforce"
    ATTACK = "attack"
    FORTIFY = "fortify"


class TreatyType(str, Enum):
    NON_AGGRESSION = "non_aggression"
    TRADE = "trade"


class PlayerKind(str, Enum):
    AGENT = "agent"
    HUMAN = "human"


class Personality(BaseModel):
    aggression: float = 0.5
    deception: float = 0.5
    cooperation: float = 0.5
    risk: float = 0.5


class Mission(BaseModel):
    type: Literal[
        "control_24",
        "control_18_two_armies",
        "control_continents",
        "destroy_player",
    ]
    target_player: str | None = None
    continents: list[str] | None = None


class Player(BaseModel):
    id: str
    name: str
    kind: PlayerKind
    alive: bool = True
    color: str
    armies_in_hand: int = 0
    cards: list[str] = Field(default_factory=list)
    mission: Mission
    reputation: float = 1.0
    personality: Personality = Field(default_factory=Personality)
    tier: Literal["easy", "normal", "hard"] = "normal"


class TerritoryState(BaseModel):
    owner: str
    armies: int = 1


class Treaty(BaseModel):
    id: str
    type: TreatyType
    players: list[str]
    expires_turn: int
    created_turn: int


class TreatyOffer(BaseModel):
    id: str
    from_player: str
    to_player: str
    type: TreatyType
    duration_turns: int = 3
    created_turn: int


class ChatMessage(BaseModel):
    id: str
    ts: float
    from_player: str
    to_player: str | None = None
    channel: Literal["public", "dm", "system"] = "public"
    text: str


class GameEvent(BaseModel):
    id: str
    ts: float
    type: str
    data: dict[str, Any] = Field(default_factory=dict)


class PhaseAction(BaseModel):
    type: Literal[
        "reinforce",
        "attack",
        "fortify",
        "trade_cards",
        "exchange_card",
    ]
    territory: str | None = None
    units: int | None = None
    from_territory: str | None = None
    to_territory: str | None = None
    dice: int | None = None
    cards: list[str] | None = None
    target_player: str | None = None
    card_id: str | None = None

    @model_validator(mode="after")
    def validate_by_type(self) -> "PhaseAction":
        if self.type == "reinforce":
            if not self.territory or self.units is None:
                raise ValueError("reinforce requires territory and units")
        elif self.type == "attack":
            if not self.from_territory or not self.to_territory:
                raise ValueError("attack requires from_territory and to_territory")
            if self.dice is None:
                self.dice = 1
        elif self.type == "fortify":
            if not self.from_territory or not self.to_territory or self.units is None:
                raise ValueError("fortify requires from_territory, to_territory, units")
        elif self.type == "trade_cards":
            if not self.cards:
                raise ValueError("trade_cards requires cards")
        elif self.type == "exchange_card":
            if not self.target_player or not self.card_id:
                raise ValueError("exchange_card requires target_player and card_id")
        return self


class ChatDraft(BaseModel):
    channel: Literal["public", "dm"] = "public"
    message: str
    to_player: str | None = None


class TreatyOfferDraft(BaseModel):
    target_player: str
    type: TreatyType
    duration_turns: int = 3


class TreatyResponseDraft(BaseModel):
    offer_id: str
    accept: bool


class BreakTreatyDraft(BaseModel):
    treaty_id: str


class ActionMeta(BaseModel):
    rationale: str | None = None


class ActionBundle(BaseModel):
    phase_actions: list[PhaseAction] = Field(default_factory=list)
    chat: list[ChatDraft] = Field(default_factory=list)
    treaty_offer: TreatyOfferDraft | None = None
    treaty_response: TreatyResponseDraft | None = None
    break_treaty: BreakTreatyDraft | None = None
    meta: ActionMeta | None = None


class GameState(BaseModel):
    game_id: str
    status: GameStatus = GameStatus.LOBBY
    seed: int
    turn: int = 1
    current_player: str | None = None
    phase: Phase = Phase.REINFORCE
    turn_deadline_ts: float | None = None
    players: list[Player] = Field(default_factory=list)
    territories: dict[str, TerritoryState] = Field(default_factory=dict)
    treaties: list[Treaty] = Field(default_factory=list)
    pending_treaty_offers: list[TreatyOffer] = Field(default_factory=list)
    chat: list[ChatMessage] = Field(default_factory=list)
    log: list[GameEvent] = Field(default_factory=list)
    winner: str | None = None
    deck: list[str] = Field(default_factory=list)
    discard: list[str] = Field(default_factory=list)
    next_trade_value: int = 4
    conquered_this_turn: bool = False


class WsEnvelope(BaseModel):
    type: Literal["state", "event"]
    payload: dict[str, Any]
