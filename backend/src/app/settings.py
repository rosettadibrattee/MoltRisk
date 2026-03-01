from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "MoltRisk"
    db_url: str = Field(default="sqlite:///./data.db", alias="DB_URL")
    default_agent_timeout: int = Field(default=30, alias="DEFAULT_AGENT_TIMEOUT")
    turn_seconds: int = Field(default=180, alias="TURN_SECONDS")
    history_event_window: int = Field(default=50, alias="HISTORY_EVENT_WINDOW")
    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
