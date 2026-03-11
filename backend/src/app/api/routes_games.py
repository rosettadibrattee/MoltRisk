from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.core.engine import game_manager
from app.core.state import ActionBundle, GameState

router = APIRouter(prefix="/api", tags=["games"])

class CreateGameRequest(BaseModel):
    map_id: str = "classic"
    seed: int | None = None

class AgentPlayerRequest(BaseModel):
    name: str
    provider: str = "ollama"
    model: str = "llama3.1:8b"
    endpoint: str = "http://ollama:11434"
    api_key: str | None = None
    personality: dict[str, float] = Field(default_factory=dict)
    tier: str = "normal"

class HumanPlayerRequest(BaseModel):
    name: str

@router.post("/games", response_model=GameState)
def create_game(req: CreateGameRequest):
    try: return game_manager.create_game(map_id=req.map_id, seed=req.seed)
    except ValueError as e: raise HTTPException(400, str(e))

@router.get("/games/{game_id}", response_model=GameState)
def get_game(game_id: str):
    try: return game_manager.get_game(game_id)
    except KeyError as e: raise HTTPException(404, str(e))

@router.post("/games/{game_id}/players/agent")
def add_agent(game_id: str, req: AgentPlayerRequest):
    try: return game_manager.add_agent_player(game_id, req.model_dump())
    except (KeyError, ValueError) as e: raise HTTPException(400, str(e))

@router.post("/games/{game_id}/players/human")
def add_human(game_id: str, req: HumanPlayerRequest):
    try: return game_manager.add_human_player(game_id, req.name)
    except (KeyError, ValueError) as e: raise HTTPException(400, str(e))

@router.post("/games/{game_id}/start", response_model=GameState)
async def start_game(game_id: str):
    try: return await game_manager.start_game(game_id)
    except (KeyError, ValueError) as e: raise HTTPException(400, str(e))

@router.post("/games/{game_id}/actions")
async def submit_human_action(game_id: str, action: ActionBundle):
    accepted, errors, state = await game_manager.submit_action(game_id, action)
    return {"accepted": accepted, "errors": errors, "state": state.model_dump(mode="json")}
