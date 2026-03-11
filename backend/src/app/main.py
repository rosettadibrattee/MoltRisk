from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes_agents import router as agents_router
from app.api.routes_games import router as games_router
from app.api.routes_ws import router as ws_router
from app.db.session import init_db
from app.settings import get_settings

settings = get_settings()
app = FastAPI(title=settings.app_name)

@app.on_event("startup")
def on_startup():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents_router)
app.include_router(games_router)
app.include_router(ws_router)
