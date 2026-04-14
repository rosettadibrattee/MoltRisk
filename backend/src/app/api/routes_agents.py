from fastapi import APIRouter, HTTPException
from app.core.engine import game_manager

router = APIRouter(prefix="/api", tags=["system"])

@router.get("/health")
def health():
    return {"status": "ok"}

@router.get("/smoke/heuristic")
async def smoke_heuristic():
    result = await game_manager.smoke_heuristic()
    if not result["completed"]:
        raise HTTPException(status_code=500, detail=result)
    return result
