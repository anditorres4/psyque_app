"""JWT validation and tenant extraction from Supabase Auth tokens."""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

_bearer = HTTPBearer()


class TenantContext:
    """Holds the authenticated tenant's identity extracted from JWT."""

    def __init__(self, tenant_id: str, user_id: str) -> None:
        self.tenant_id = tenant_id
        self.user_id = user_id


def get_current_tenant(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> TenantContext:
    """FastAPI dependency: validate Supabase JWT and extract tenant_id.

    Supabase JWTs store the user UUID in 'sub'. The tenant_id is stored
    in 'app_metadata.tenant_id', populated by a database trigger when
    the tenant row is created during onboarding.

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
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
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
