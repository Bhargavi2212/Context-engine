"""Connectors API: list, connect Slack, disconnect, sync, history."""
from typing import Annotated, Any

import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser
from app.services import connector_service

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("")
def list_connectors(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict[str, Any]:
    """List all connectors for the current org."""
    items = connector_service.list_connectors(conn, current_user.org_id)
    return {"data": items}


@router.post("/slack", status_code=status.HTTP_201_CREATED)
def connect_slack(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    body: dict[str, Any],
) -> dict[str, Any]:
    """Connect Slack: mode 'simulated' (demo) or 'live' (real MCP). Body: mode, channels/channel_ids, poll_interval_seconds; for live: slack_bot_token, slack_team_id."""
    mode = (body.get("mode") or "").strip().lower()
    if mode == "live":
        try:
            result = connector_service.connect_slack_live(conn, current_user.org_id, body)
            return {"data": result}
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    if mode != "simulated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="mode must be 'simulated' or 'live'. For live: slack_bot_token, slack_team_id, channel_ids (or channels), poll_interval_seconds.",
        )
    result = connector_service.connect_slack_simulated(conn, current_user.org_id, body)
    return {"data": result}


@router.get("/{connector_id}")
def get_connector(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    connector_id: str,
) -> dict[str, Any]:
    """Get one connector by id."""
    c = connector_service.get_connector(conn, connector_id, current_user.org_id)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")
    return {"data": c}


@router.delete("/{connector_id}")
def disconnect_connector(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    connector_id: str,
) -> dict[str, Any]:
    """Disconnect a connector (stops polling)."""
    if not connector_service.get_connector(conn, connector_id, current_user.org_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")
    connector_service.disconnect(conn, connector_id, current_user.org_id)
    return {"data": {"id": connector_id, "status": "disconnected"}}


@router.post("/{connector_id}/sync")
async def sync_connector(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    connector_id: str,
) -> dict[str, Any]:
    """Trigger one sync run now."""
    if not connector_service.get_connector(conn, connector_id, current_user.org_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")
    updated = await connector_service.sync_now(conn, current_user.org_id, connector_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sync not available for this connector")
    return {"data": updated}


@router.patch("/{connector_id}")
def update_connector(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    connector_id: str,
    body: dict[str, Any],
) -> dict[str, Any]:
    """Update connector config (channels, poll_interval_seconds). Restart poller if interval changed."""
    if not connector_service.get_connector(conn, connector_id, current_user.org_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")
    channels = body.get("channels")
    if channels is not None and not isinstance(channels, list):
        channels = [ch.strip() for ch in str(channels).split(",") if ch.strip()]
    poll_interval_seconds = body.get("poll_interval_seconds")
    updated = connector_service.update_connector_config(
        conn, connector_id, current_user.org_id, channels=channels, poll_interval_seconds=poll_interval_seconds
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Update not applied")
    return {"data": updated}


@router.get("/{connector_id}/history")
def get_connector_history(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    connector_id: str,
) -> dict[str, Any]:
    """Get recent sync history for a connector."""
    if not connector_service.get_connector(conn, connector_id, current_user.org_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")
    items = connector_service.get_history(conn, connector_id, current_user.org_id, limit=20)
    return {"data": items}
