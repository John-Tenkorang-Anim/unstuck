"""Runtime configuration, loaded once from environment variables (pydantic-settings).

Every tunable number in the spec lives here, so it can change without a deploy
where noted. Nothing else reads os.environ directly.
"""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All settings. Defaults are safe for local development with the fakes."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PRODUCT_NAME: str = "Unstuck"
    BASE_URL: str = "http://localhost:3000"
    DATABASE_URL: str = "postgresql://app:app@localhost:5432/unstuck"
    REDIS_URL: str | None = None  # None → in-memory EventBus/queues (weeks 1–4)
    S3_ENDPOINT: str | None = None
    S3_PRIVATE_BUCKET: str = "unstuck-private"
    S3_PUBLIC_BUCKET: str = "unstuck-public"  # the ONLY bucket the CDN can read (INV-03)
    S3_KEY_ID: str | None = None
    S3_SECRET: str | None = None
    CDN_BASE_URL: str | None = None
    WEBAUTHN_RP_ID: str = "localhost"
    WEBAUTHN_ORIGIN: str = "http://localhost:3000"
    SESSION_DAYS: int = 30
    EMAIL_ENC_KEY: str | None = None
    LLM_URL: str | None = None  # llama.cpp server
    EMBED_MODEL_PATH: str | None = None  # multilingual, 384-d, ONNX int8
    TRANSLATE_MODEL_DIR: str | None = None  # CTranslate2 model directory
    WHISPER_MODEL_PATH: str | None = None
    UI_LANGS: list[str] = ["en", "fr", "pt", "es", "sw", "ar"]
    HIGH_STAKES_REQUIRE_REVIEW: bool = True  # INV-10
    MEDIA_AUTO_APPROVE_MIN_AGE_DAYS: int = 7
    MEDIA_AUTO_APPROVE_MIN_TRUST: float = 1.0
    UPLOADS_OPEN_TO: str = "pilot"  # "pilot" until hash-matching is live, then "all"
    VERIFY_MIN_REPLICATIONS: int = 2
    VERIFY_MIN_ACCOUNT_AGE_DAYS: int = 7
    REVIEWER_MIN_TRUST: float = 2.0
    PROBLEM_STALE_DAYS: int = 30
    IMPACT_MIN_GROUP: int = 10  # F-18
    CONTEXT_MIN_REPORTS: int = 5  # AC-03.3
    FEED_WEIGHTS: dict[str, float] = Field(
        default_factory=lambda: {"fresh": 0.35, "evidence": 0.25, "helped": 0.2, "topic": 0.2}
    )
    API_INTERNAL_URL: str = "http://localhost:8000"
    LIVE_FALLBACK: str = "python"
    RELAY_IMPL: str = "python"
    RELAY_BATCH: int = 100
    RELAY_INTERVAL_MS: int = 1000
    INTAKE_BIN: str = "intake"
    INTAKE_SUBPROCESS_PATH: str = "/usr/local/bin:/usr/bin:/bin"
    INTAKE_MAX_PIXELS: int = 40_000_000
    INTAKE_MAX_PAGES: int = 200
    INTAKE_MAX_ROWS: int = 50_000


@lru_cache
def get_settings() -> Settings:
    return Settings()
