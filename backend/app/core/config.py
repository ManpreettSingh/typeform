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
    
    # SEED_DEMO_DATA=true: add the demo forms and responses (app/seed.py) at startup if they're missing, so a hosted
    # demo is usable right away. Safe to leave on: seeding skips forms that already exist. Off by default.
    seed_demo_data: bool = False

    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Payment questions (Razorpay). Test keys start with rzp_test_. Without both, order and verification answer "Payments
    # aren't set up yet". The key id is public (Checkout needs it); the secret never leaves the server.
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_api_base: str = "https://api.razorpay.com/v1"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
