"""JWT encode/decode and password hashing (bcrypt)."""
from datetime import datetime, timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.config import settings

# Bcrypt only uses the first 72 bytes of the password.
BCRYPT_MAX_PASSWORD_BYTES = 72


def _truncate_for_bcrypt(password: str) -> bytes:
    """Truncate password to 72 bytes for bcrypt. Returns bytes."""
    encoded = password.encode("utf-8")
    if len(encoded) <= BCRYPT_MAX_PASSWORD_BYTES:
        return encoded
    return encoded[:BCRYPT_MAX_PASSWORD_BYTES]


def hash_password(plain: str) -> str:
    """Hash a password with bcrypt. Passwords longer than 72 bytes are truncated."""
    pwd_bytes = _truncate_for_bcrypt(plain)
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against its hash. Passwords longer than 72 bytes are truncated."""
    pwd_bytes = _truncate_for_bcrypt(plain)
    hashed_bytes = hashed.encode("utf-8") if isinstance(hashed, str) else hashed
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)


def create_access_token(payload: dict[str, Any]) -> str:
    """Create a JWT access token. Payload should include sub, org_id, email; exp added here."""
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {**payload, "exp": expire}
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict[str, Any] | None:
    """Decode and validate JWT. Returns payload or None if invalid."""
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        return None
