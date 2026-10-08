from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./app.db"
    cors_origins: str = "http://localhost:3000"
    api_prefix: str = "/api"
    # "Create with AI" (Typeform AI). Without a key the AI endpoints answer 503 with setup instructions.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
