"""JWT validation and tenant extraction from Supabase Auth tokens (ES256 / ECC P-256)."""
import json
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

_bearer = HTTPBearer()

# Parse the JWK once at startup — avoids re-parsing on every request
_PUBLIC_KEY: dict = {}


def _get_public_key() -> dict:
    """Return the parsed EC public JWK, loading it once from settings."""
    global _PUBLIC_KEY
    if not _PUBLIC_KEY:
        _PUBLIC_KEY = json.loads(settings.supabase_jwt_jwk)
    return _PUBLIC_KEY


class AuthUser:
    """Authenticated user — JWT is valid but tenant may not be configured yet."""

    def __init__(self, user_id: str, user_metadata: dict) -> None:
        self.user_id = user_id
        self.user_metadata = user_metadata


def get_auth_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> "AuthUser":
    """FastAPI dependency: validate JWT and return user without requiring tenant_id.

    Use this for endpoints that must work before the tenant profile is configured
    (e.g. POST /auth/setup-profile).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials,
            _get_public_key(),
            algorithms=["ES256"],
            options={"verify_aud": False},
        )
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise credentials_exception
        user_metadata: dict = payload.get("user_metadata", {})
    except JWTError:
        raise credentials_exception
    return AuthUser(user_id=user_id, user_metadata=user_metadata)


class TenantContext:
    """Holds the authenticated tenant's identity extracted from JWT."""

    def __init__(self, tenant_id: str, user_id: str) -> None:
        self.tenant_id = tenant_id
        self.user_id = user_id


def get_current_tenant(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> TenantContext:
    """FastAPI dependency: validate Supabase JWT (ES256) and extract tenant_id.

    Supabase projects with ECC P-256 sign tokens using ES256.
    The public JWK is stored in SUPABASE_JWT_JWK env var and used for
    signature verification only — no shared secret needed.

    Args:
        credentials: Bearer token from Authorization header.

    Returns:
        TenantContext with tenant_id and user_id.

    Raises:
        HTTPException 401: Token invalid, expired, or tenant_id missing.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials,
            _get_public_key(),
            algorithms=["ES256"],
            options={"verify_aud": False},  # Supabase tokens omit aud claim
        )
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise credentials_exception

        app_metadata: dict = payload.get("app_metadata", {})
        tenant_id: str = app_metadata.get("tenant_id", "")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Cuenta no configurada. Complete el registro para activar su acceso.",
            )
    except JWTError:
        raise credentials_exception

    return TenantContext(tenant_id=tenant_id, user_id=user_id)


CurrentTenant = Annotated[TenantContext, Depends(get_current_tenant)]
