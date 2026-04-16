"""Application configuration loaded from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All settings required at startup — app fails fast if any is missing."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_jwk: str  # JSON string del JWK EC público — Settings → API → JWT Settings → JWKS
    supabase_database_url: str  # postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres

    # App
    app_url: str = "http://localhost:3000"
    environment: str = "development"

    # Email (Resend)
    resend_api_key: str = ""

    @property
    def is_development(self) -> bool:
        """True when running in development environment."""
        return self.environment == "development"


settings = Settings()
