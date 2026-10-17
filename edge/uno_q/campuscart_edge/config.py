from pydantic_settings import BaseSettings, SettingsConfigDict


class EdgeSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    campuscart_api_url: str = "http://localhost:8000"
    campuscart_api_token: str = ""  # scoped read-only token created in Seller Studio
    telegram_bot_token: str = ""
    telegram_allowed_chat_ids: str = ""  # comma separated allow-list; empty = bot refuses everyone
    local_llm_url: str = ""  # optional OpenAI-compatible server; summaries fall back to rules

    @property
    def allowed_chats(self) -> set[int]:
        return {int(x) for x in self.telegram_allowed_chat_ids.split(",") if x.strip().lstrip("-").isdigit()}
