"""Connector service: connect/list/disconnect/sync/history for Slack (simulated) and future MCP."""
import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Any

from app.database import get_db_sync
from app.services.live_slack_mcp import _do_one_live_cycle, poll_live_slack
from app.services.simulated_mcp import _do_one_poll_cycle, poll_simulated_feed

logger = logging.getLogger(__name__)

# connector_id -> asyncio.Task for background poller
_poll_tasks: dict[str, asyncio.Task] = {}


def _row_to_connector_dict(row: Any) -> dict[str, Any]:
    """Convert connector row to API-shaped dict. Masks slack_bot_token in config."""
    config = {}
    if row.get("config"):
        try:
            config = json.loads(row["config"]).copy()
        except (json.JSONDecodeError, TypeError):
            pass
    if config.get("slack_bot_token"):
        config["slack_bot_token"] = "***"
    channels = config.get("channels", [])
    if not channels and config.get("channel_ids"):
        channels = config["channel_ids"]
    return {
        "id": row["id"],
        "type": row["type"],
        "status": row["status"],
        "config": config,
        "channels": channels,
        "poll_interval_seconds": config.get("poll_interval_seconds"),
        "last_sync_at": row["last_sync_at"],
        "messages_processed": row["messages_processed"] or 0,
        "noise_filtered": row.get("noise_filtered") or 0,
        "last_error": row["last_error"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def connect_slack_simulated(conn: Any, org_id: str, body: dict[str, Any]) -> dict[str, Any]:
    """Create connector row, insert 'started' history row, start background poller. Returns connector dict."""
    connector_id = str(uuid.uuid4())
    channels = body.get("channels") or []
    poll_interval_seconds = body.get("poll_interval_seconds", 60)
    if poll_interval_seconds not in (30, 60, 300):
        poll_interval_seconds = 60
    config = {
        "mode": "simulated",
        "channels": channels if isinstance(channels, list) else [ch.strip() for ch in str(channels).split(",") if ch.strip()],
        "poll_interval_seconds": poll_interval_seconds,
    }
    config_str = json.dumps(config)
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    conn.execute(
        """INSERT INTO connectors (id, org_id, type, status, config, created_at, updated_at)
           VALUES (?, ?, 'slack', 'connected', ?, ?, ?)""",
        (connector_id, org_id, config_str, now, now),
    )
    history_id = str(uuid.uuid4())
    conn.execute(
        """INSERT INTO connector_sync_history (id, connector_id, event_type, messages_count, noise_filtered, created_at)
           VALUES (?, ?, 'started', 0, 0, ?)""",
        (history_id, connector_id, now),
    )
    conn.commit()

    # Start background poller with its own DB connection
    db = get_db_sync()
    task = asyncio.create_task(
        poll_simulated_feed(db, org_id, connector_id, poll_interval_seconds)
    )
    _poll_tasks[connector_id] = task
    logger.info("Started simulated Slack connector %s for org %s", connector_id[:8], org_id)

    return {
        "id": connector_id,
        "type": "slack",
        "status": "connected",
        "channels": config["channels"],
        "poll_interval_seconds": config["poll_interval_seconds"],
    }


def connect_slack_live(conn: Any, org_id: str, body: dict[str, Any]) -> dict[str, Any]:
    """Create live Slack connector (MCP server), start background poller. Returns connector dict."""
    connector_id = str(uuid.uuid4())
    token = (body.get("slack_bot_token") or "").strip()
    team_id = (body.get("slack_team_id") or "").strip()
    channel_ids = body.get("channel_ids") or body.get("channels") or []
    if isinstance(channel_ids, str):
        channel_ids = [c.strip() for c in channel_ids.split(",") if c.strip()]
    if not isinstance(channel_ids, list):
        channel_ids = [str(c).strip() for c in channel_ids] if channel_ids else []
    poll_interval_seconds = body.get("poll_interval_seconds", 60)
    if poll_interval_seconds not in (30, 60, 300):
        poll_interval_seconds = 60
    if not token or not team_id:
        raise ValueError("slack_bot_token and slack_team_id are required")
    if not channel_ids:
        raise ValueError("At least one channel_id is required for live Slack")

    config = {
        "mode": "live",
        "slack_bot_token": token,
        "slack_team_id": team_id,
        "channel_ids": channel_ids,
        "channels": channel_ids,
        "poll_interval_seconds": poll_interval_seconds,
    }
    config_str = json.dumps(config)
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    conn.execute(
        """INSERT INTO connectors (id, org_id, type, status, config, created_at, updated_at)
           VALUES (?, ?, 'slack', 'connected', ?, ?, ?)""",
        (connector_id, org_id, config_str, now, now),
    )
    history_id = str(uuid.uuid4())
    conn.execute(
        """INSERT INTO connector_sync_history (id, connector_id, event_type, messages_count, noise_filtered, created_at)
           VALUES (?, ?, 'started', 0, 0, ?)""",
        (history_id, connector_id, now),
    )
    conn.commit()

    db = get_db_sync()
    task = asyncio.create_task(poll_live_slack(db, org_id, connector_id, poll_interval_seconds))
    _poll_tasks[connector_id] = task
    logger.info("Started live Slack connector %s for org %s", connector_id[:8], org_id)

    return {
        "id": connector_id,
        "type": "slack",
        "status": "connected",
        "mode": "live",
        "channels": channel_ids,
        "channel_ids": channel_ids,
        "poll_interval_seconds": poll_interval_seconds,
    }


def list_connectors(conn: Any, org_id: str) -> list[dict[str, Any]]:
    """List all connectors for org."""
    cursor = conn.execute(
        "SELECT * FROM connectors WHERE org_id = ? ORDER BY type, created_at",
        (org_id,),
    )
    return [_row_to_connector_dict(dict(row)) for row in cursor.fetchall()]


def get_connector(conn: Any, connector_id: str, org_id: str) -> dict[str, Any] | None:
    """Get one connector by id if it belongs to org."""
    cursor = conn.execute(
        "SELECT * FROM connectors WHERE id = ? AND org_id = ?",
        (connector_id, org_id),
    )
    row = cursor.fetchone()
    return _row_to_connector_dict(dict(row)) if row else None


def disconnect(conn: Any, connector_id: str, org_id: str) -> bool:
    """Cancel poll task and set status to disconnected. Returns True if found and disconnected."""
    if connector_id in _poll_tasks:
        task = _poll_tasks.pop(connector_id)
        task.cancel()
    cursor = conn.execute(
        "UPDATE connectors SET status = 'disconnected', updated_at = datetime('now') WHERE id = ? AND org_id = ?",
        (connector_id, org_id),
    )
    conn.commit()
    return cursor.rowcount > 0


async def sync_now(conn: Any, org_id: str, connector_id: str) -> dict[str, Any] | None:
    """Run one poll cycle immediately. Returns updated connector dict or None if not found."""
    row = conn.execute("SELECT id, type, config FROM connectors WHERE id = ? AND org_id = ?", (connector_id, org_id)).fetchone()
    if not row:
        return None
    if row["type"] != "slack":
        return None
    config = json.loads(row["config"]) if row["config"] else {}
    if config.get("mode") == "simulated":
        await _do_one_poll_cycle(conn, org_id, connector_id)
    elif config.get("mode") == "live":
        await _do_one_live_cycle(conn, org_id, connector_id, config)
    else:
        return None
    return get_connector(conn, connector_id, org_id)


def get_history(conn: Any, connector_id: str, org_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Return recent sync history for connector (must belong to org)."""
    cursor = conn.execute(
        """SELECT id, connector_id, event_type, messages_count, noise_filtered, channel_or_detail, created_at
           FROM connector_sync_history h
           WHERE h.connector_id = ? AND EXISTS (SELECT 1 FROM connectors c WHERE c.id = h.connector_id AND c.org_id = ?)
           ORDER BY h.created_at DESC LIMIT ?""",
        (connector_id, org_id, limit),
    )
    return [dict(row) for row in cursor.fetchall()]


def update_connector_config(
    conn: Any, connector_id: str, org_id: str, channels: list[str] | None = None, poll_interval_seconds: int | None = None
) -> dict[str, Any] | None:
    """Update connector config (channels and/or poll_interval_seconds). Restart poller if interval changed. Returns updated connector or None."""
    c = get_connector(conn, connector_id, org_id)
    if not c or c["status"] != "connected" or c["type"] != "slack":
        return None
    config = c.get("config") or {}
    if config.get("mode") != "simulated":
        return None
    updated = False
    if channels is not None:
        config["channels"] = channels
        updated = True
    if poll_interval_seconds is not None and poll_interval_seconds in (30, 60, 300):
        config["poll_interval_seconds"] = poll_interval_seconds
        updated = True
    if not updated:
        return c
    config_str = json.dumps(config)
    conn.execute(
        "UPDATE connectors SET config = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?",
        (config_str, connector_id, org_id),
    )
    conn.commit()
    # Restart poller with new interval
    if connector_id in _poll_tasks:
        task = _poll_tasks.pop(connector_id)
        task.cancel()
    db = get_db_sync()
    interval = config.get("poll_interval_seconds", 60)
    task = asyncio.create_task(poll_simulated_feed(db, org_id, connector_id, interval))
    _poll_tasks[connector_id] = task
    return get_connector(conn, connector_id, org_id)


def get_poll_tasks() -> dict[str, asyncio.Task]:
    """Return the poll tasks dict (for shutdown)."""
    return _poll_tasks


def start_restored_poller(connector_id: str, org_id: str, config: dict) -> None:
    """Start a poller for a connector restored on startup (simulated or live; uses its own DB connection)."""
    interval = config.get("poll_interval_seconds", 60)
    db = get_db_sync()
    if config.get("mode") == "live":
        task = asyncio.create_task(poll_live_slack(db, org_id, connector_id, interval))
        logger.info("Restored live Slack connector %s for org %s", connector_id[:8], org_id)
    else:
        task = asyncio.create_task(poll_simulated_feed(db, org_id, connector_id, interval))
        logger.info("Restored simulated Slack connector %s for org %s", connector_id[:8], org_id)
    _poll_tasks[connector_id] = task
