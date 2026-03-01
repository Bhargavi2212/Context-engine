"""Auth business logic: signup, login, get_me."""
import logging
import sqlite3
from uuid import uuid4

from app.models.schemas import AuthResponse, UserResponse
from app.utils.security import create_access_token, hash_password, verify_password

logger = logging.getLogger(__name__)


def signup(conn: sqlite3.Connection, email: str, password: str, full_name: str, org_name: str) -> AuthResponse:
    """Create org and user, return AuthResponse. Raises ValueError if email already exists."""
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE email = ?", (email,))
    if cur.fetchone():
        logger.warning("Signup attempted with existing email: %s", email[:3] + "***")
        raise ValueError("A user with this email already exists")
    org_id = str(uuid4())
    user_id = str(uuid4())
    password_hash = hash_password(password)
    cur.execute("INSERT INTO organizations (id, name) VALUES (?, ?)", (org_id, org_name))
    cur.execute(
        "INSERT INTO users (id, org_id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, org_id, email, password_hash, full_name, "pm"),
    )
    conn.commit()
    logger.info("New user signed up: %s***", email[:1])
    user_response = UserResponse(
        user_id=user_id,
        email=email,
        full_name=full_name,
        org_id=org_id,
        org_name=org_name,
        role="pm",
    )
    token = create_access_token({"sub": user_id, "org_id": org_id, "email": email})
    return AuthResponse(user=user_response, access_token=token, token_type="bearer")


def login(conn: sqlite3.Connection, email: str, password: str) -> AuthResponse:
    """Verify credentials, return AuthResponse. Raises ValueError if invalid."""
    cur = conn.cursor()
    cur.execute(
        "SELECT u.id, u.org_id, u.email, u.full_name, u.password_hash, u.role, o.name FROM users u "
        "JOIN organizations o ON u.org_id = o.id WHERE u.email = ?",
        (email,),
    )
    row = cur.fetchone()
    if not row:
        logger.warning("Login failed: email not found")
        raise ValueError("Invalid email or password")
    user_id, org_id, em, full_name, password_hash, role, org_name = row
    if not verify_password(password, password_hash):
        logger.warning("Login failed: wrong password for %s***", email[:1])
        raise ValueError("Invalid email or password")
    logger.info("User logged in: %s***", email[:1])
    user_response = UserResponse(
        user_id=user_id,
        email=em,
        full_name=full_name,
        org_id=org_id,
        org_name=org_name,
        role=role or "pm",
    )
    token = create_access_token({"sub": user_id, "org_id": org_id, "email": em})
    return AuthResponse(user=user_response, access_token=token, token_type="bearer")


def get_me(conn: sqlite3.Connection, user_id: str) -> UserResponse:
    """Return UserResponse for user_id. Raises ValueError if not found."""
    cur = conn.cursor()
    cur.execute(
        "SELECT u.id, u.org_id, u.email, u.full_name, u.role, o.name FROM users u "
        "JOIN organizations o ON u.org_id = o.id WHERE u.id = ?",
        (user_id,),
    )
    row = cur.fetchone()
    if not row:
        raise ValueError("User not found")
    uid, org_id, email, full_name, role, org_name = row
    return UserResponse(
        user_id=uid,
        email=email,
        full_name=full_name,
        org_id=org_id,
        org_name=org_name,
        role=role or "pm",
    )
