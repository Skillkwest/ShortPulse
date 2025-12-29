"""
Configuration helpers for the backend service.
Loads environment variables via Pydantic and exposes a cached settings instance.
"""
from functools import lru_cache
from typing import Optional

from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    database_url: str = Field(..., env="DATABASE_URL")
    apify_api_token: Optional[str] = Field(None, env="APIFY_API_TOKEN")
    apify_actor_id: Optional[str] = Field(None, env="APIFY_ACTOR_ID")
    apify_max_results: int = Field(200, env="APIFY_MAX_RESULTS")
    ingestion_interval_hours: int = Field(6, env="INGESTION_INTERVAL_HOURS")
    ingestion_user_id: Optional[str] = Field(None, env="INGESTION_USER_ID")
    supabase_jwt_secret: str = Field(..., env="SUPABASE_JWT_SECRET")
    supabase_jwt_audience: Optional[str] = Field("authenticated", env="SUPABASE_JWT_AUDIENCE")
    environment: str = Field("local", env="ENVIRONMENT")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """
    Load and cache application settings from environment variables.

    Returns:
        A singleton Settings instance reused across imports.
    Side Effects:
        Reads environment variables once and caches the result.
    """
    return Settings()


settings = get_settings()
