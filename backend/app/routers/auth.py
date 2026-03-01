"""Auth endpoints: signup, login, me."""
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser, LoginRequest, SignupRequest
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup_endpoint(req: SignupRequest, conn: Annotated[sqlite3.Connection, Depends(get_db)]):
    """Create account and org, return user and token in { data }."""
    try:
        result = auth_service.signup(
            conn, req.email, req.password, req.full_name, req.org_name
        )
        return {"data": result.model_dump()}
    except ValueError as e:
        msg = str(e)
        if "already exists" in msg.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)


@router.post("/login")
def login_endpoint(req: LoginRequest, conn: Annotated[sqlite3.Connection, Depends(get_db)]):
    """Login and return user and token in { data }."""
    try:
        result = auth_service.login(conn, req.email, req.password)
        return {"data": result.model_dump()}
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )


@router.get("/me")
def me_endpoint(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
):
    """Return current user info in { data } (flat user object)."""
    try:
        user = auth_service.get_me(conn, current_user.user_id)
        return {"data": user.model_dump()}
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
