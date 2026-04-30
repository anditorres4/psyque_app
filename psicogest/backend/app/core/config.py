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
    app_url: str = "http://localhost:5173"
    cors_origins: str = ""
    environment: str = "development"

    # Email (Resend)
    resend_api_key: str = ""
    resend_from_email: str = "noreply@psyque.app"

    # --- Google Calendar OAuth2 ---
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/google-calendar/callback"

    # --- 100ms Video ---
    hms_app_key: str = ""
    hms_app_secret: str = ""
    hms_template_id: str = ""

    @property
    def is_development(self) -> bool:
        """True when running in development environment."""
        return self.environment == "development"

    @property
    def allowed_cors_origins(self) -> list[str]:
        """Return the normalized list of allowed CORS origins."""
        origins = [self.app_url]
        if self.cors_origins.strip():
            origins.extend(
                origin.strip()
                for origin in self.cors_origins.split(",")
                if origin.strip()
            )
        return list(dict.fromkeys(origins))


settings = Settings()
