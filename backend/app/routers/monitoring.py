"""Monitoring API: GET /monitoring/agent-stats for Settings > System Status."""
from typing import Annotated

from fastapi import APIRouter, Depends

from app.database import get_db
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser
from app.services import monitoring_service

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/agent-stats")
def get_agent_stats(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated = Depends(get_db),
):
    """Return agent call stats for the org: total calls, avg latency, tool counts, model usage %, recent activity."""
    stats = monitoring_service.get_agent_stats(conn, current_user.org_id)
    return {"data": stats}
