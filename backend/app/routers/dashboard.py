"""Dashboard API: single GET that returns all 9 widget payloads."""
from datetime import datetime, timedelta
from typing import Annotated

import sqlite3
from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _parse_period(period: str | None, date_from: str | None, date_to: str | None) -> tuple[str | None, str | None]:
    """Return (date_from, date_to) for filtering. None means no filter."""
    if date_from and date_to:
        return date_from, date_to
    if not period or period == "custom":
        return None, None
    today = datetime.utcnow().date()
    if period == "7d":
        start = today - timedelta(days=7)
    elif period == "90d":
        start = today - timedelta(days=90)
    else:
        start = today - timedelta(days=30)  # 30d default
    return start.isoformat(), today.isoformat()


@router.get("")
def get_dashboard(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    period: str | None = Query(None, description="7d, 30d, 90d, or custom"),
    date_from: str | None = Query(None, description="YYYY-MM-DD when period=custom"),
    date_to: str | None = Query(None, description="YYYY-MM-DD when period=custom"),
) -> dict:
    """Return all dashboard widget data in one response. Optional period/date filter."""
    from_, to_ = _parse_period(period, date_from, date_to)
    data = dashboard_service.get_dashboard_data(conn, current_user.org_id, date_from=from_, date_to=to_)
    return {"data": data}
