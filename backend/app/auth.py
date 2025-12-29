"""
Authentication helpers for FastAPI routes.
Verifies Supabase JWTs and exposes a dependency that returns the authenticated user.
"""
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status

from .config import settings


@dataclass
class AuthenticatedUser:
    """Authenticated user extracted from a Supabase JWT."""

    user_id: str
    email: Optional[str] = None
    role: Optional[str] = None
    token: Optional[str] = None


def _get_bearer_token(authorization: Optional[str] = Header(None)) -> str:
    """Extract the bearer token from the Authorization header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format",
        )
    return token


def require_user(token: str = Depends(_get_bearer_token)) -> AuthenticatedUser:
    """Validate the Supabase JWT and return the authenticated user context."""
    try:
        decoded = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience=settings.supabase_jwt_audience or None,
            options={"verify_aud": bool(settings.supabase_jwt_audience)},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token") from exc

    user_id = decoded.get("sub") or decoded.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing user id in token")

    return AuthenticatedUser(
        user_id=str(user_id),
        email=decoded.get("email"),
        role=decoded.get("role"),
        token=token,
    )

