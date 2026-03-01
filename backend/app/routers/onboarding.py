"""Onboarding status API."""
from typing import Annotated

import sqlite3
from fastapi import APIRouter, Depends

from app.database import get_db
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser
from app.services import product_context_service

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.get("/status")
def get_status(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Get onboarding completion status for current org."""
    data = product_context_service.get_onboarding_status(
        conn, current_user.org_id
    )
    return {"data": data}
