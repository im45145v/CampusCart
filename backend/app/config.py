from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "campuscart"
    jwt_secret: str = Field(default="dev-insecure-secret-change-me-0123456789", min_length=16)
    jwt_ttl_minutes: int = 60 * 12
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    environment: str = "development"

    upload_dir: str = "uploads"
    max_upload_bytes: int = 2 * 1024 * 1024

    chat_rate_limit_messages: int = 10
    chat_rate_limit_window_s: int = 10
    auth_rate_limit_attempts: int = 10
    auth_rate_limit_window_s: int = 60

    # Optional. A key alone uses hosted Gemma 4. GEMMA_BASE_URL overrides that with a local server.
    gemma_base_url: str = ""  # OpenAI-compatible server (Ollama: http://localhost:11434/v1)
    gemma_model: str = "gemma-4-26b-a4b-it"
    gemma_api_key: str = ""
    elevenlabs_api_key: str = ""
    elevenlabs_stt_model: str = "scribe_v1"

    # Email sign-in. Empty RESEND_API_KEY in development returns the code to the caller.
    # Production refuses to send until Resend, a from address, and an https site URL are set.
    resend_api_key: str = ""
    email_from: str = ""
    public_web_url: str = "http://localhost:5173"
    otp_ttl_minutes: int = 10
    otp_max_attempts: int = 5

    # Shown on the add-funds form. Public payment address, not a secret.
    # A typed UPI reference is not proof; an admin still has to approve the top-up.
    admin_upi_id: str = "im45145v@oksbi"

    @field_validator("admin_upi_id")
    @classmethod
    def clean_admin_upi(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            return "im45145v@oksbi"
        if len(cleaned) > 80 or "@" not in cleaned or any(ch.isspace() for ch in cleaned):
            raise ValueError("ADMIN_UPI_ID must be a UPI id such as name@bank")
        return cleaned

    def validate_for_runtime(self) -> None:
        if self.environment == "production" and self.jwt_secret.startswith("dev-insecure"):
            raise RuntimeError("Set JWT_SECRET to a long random value in production")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
