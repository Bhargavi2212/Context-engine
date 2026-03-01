"""Application settings from environment variables."""
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Load from .env; pydantic-settings maps DATABASE_PATH to database_path."""

    mistral_api_key: str = ""
    langchain_tracing_v2: bool = True
    langchain_api_key: str = ""
    langchain_project: str = "context-engine-mistral"
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440
    database_path: str = "./data/context_engine.db"
    backend_cors_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
    api_v1_prefix: str = "/api/v1"

    @property
    def cors_origins(self) -> List[str]:
        """Split CORS origins string into list. Never return empty for dev."""
        origins = [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]
        if not origins:
            return [
                "http://localhost:3000",
                "http://localhost:5173",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173",
            ]
        return origins

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
