"""Pydantic request/response schemas for auth and health."""
from pydantic import BaseModel, EmailStr, field_validator


class SignupRequest(BaseModel):
    """Sign up: email, password (min 8), full_name, org_name."""
    email: EmailStr
    password: str
    full_name: str
    org_name: str

    @field_validator("password", mode="after")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    """Login: email, password."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """User info returned in auth and /me."""
    user_id: str
    email: str
    full_name: str
    org_id: str
    org_name: str
    role: str


class AuthResponse(BaseModel):
    """Signup/login response: user + token."""
    user: UserResponse
    access_token: str
    token_type: str = "bearer"


class HealthResponse(BaseModel):
    """Health check: status, database, mistral, version."""
    status: str
    database: dict
    mistral: dict
    version: str


class CurrentUser(BaseModel):
    """From JWT: user_id, org_id, email (for get_current_user)."""
    user_id: str
    org_id: str
    email: str


class ErrorResponse(BaseModel):
    """Error detail."""
    detail: str
    status_code: int
