"""JWT validation and tenant extraction from Supabase Auth tokens (ES256 / ECC P-256)."""
import json
from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt.algorithms import ECAlgorithm
from jwt.exceptions import InvalidTokenError

from app.core.config import settings

_bearer = HTTPBearer()

# Cached EC key object for PyJWT — loaded once, avoids re-parsing on every request
_PUBLIC_KEY: Any = None


def _get_public_key() -> Any:
    """Return the EC public key object (cryptography library) for PyJWT ES256 verification.

    PyJWT requires a key object from the `cryptography` library, not a raw JWK dict.
    ECAlgorithm.from_jwk() performs the conversion from the stored JWK JSON string.
    """
    global _PUBLIC_KEY
    if _PUBLIC_KEY is None:
        jwk_dict = json.loads(settings.supabase_jwt_jwk)
        _PUBLIC_KEY = ECAlgorithm.from_jwk(json.dumps(jwk_dict))
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
    except InvalidTokenError:
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
        if app_metadata.get("role") == "patient":
            raise HTTPException(
                status_code=403,
                detail="Acceso restringido a psicólogos",
            )
        tenant_id: str = app_metadata.get("tenant_id", "")
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Cuenta no configurada. Complete el registro para activar su acceso.",
            )
    except InvalidTokenError:
        raise credentials_exception

    return TenantContext(tenant_id=tenant_id, user_id=user_id)


CurrentTenant = Annotated[TenantContext, Depends(get_current_tenant)]


class PatientContext:
    """Authenticated patient — JWT role is 'patient' with patient_id in app_metadata."""

    def __init__(self, patient_id: str, user_id: str) -> None:
        self.patient_id = patient_id  # patients table UUID
        self.user_id = user_id        # auth.users UUID


def get_current_patient(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> "PatientContext":
    """FastAPI dependency: validate JWT and return PatientContext.

    Requires app_metadata.role == 'patient' and app_metadata.patient_id set.
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
        app_metadata: dict = payload.get("app_metadata", {})
        if app_metadata.get("role") != "patient":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso restringido al portal de pacientes.",
            )
        patient_id: str = app_metadata.get("patient_id", "")
        if not patient_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Cuenta de paciente no vinculada. Contacta a tu psicólogo.",
            )
    except InvalidTokenError:
        raise credentials_exception
    return PatientContext(patient_id=patient_id, user_id=user_id)


CurrentPatient = Annotated[PatientContext, Depends(get_current_patient)]
