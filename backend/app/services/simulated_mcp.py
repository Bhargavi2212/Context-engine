"""Simulated MCP: poll a JSON feed file and process messages through the classification pipeline."""
import asyncio
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from app.services.feedback_service import process_single_message

logger = logging.getLogger(__name__)

DEFAULT_FEED_PATH = Path(__file__).resolve().parent.parent.parent / "test-data" / "slack_feed.json"
MAX_PROCESSED_IDS = 1000


async def _do_one_poll_cycle(
    conn: Any,
    org_id: str,
    connector_id: str,
    feed_path: Path | None = None,
) -> tuple[int, int]:
    """Run one read/process/update cycle. Returns (messages_processed, noise_count). Uses processed_message_ids in connector config."""
    path = feed_path or DEFAULT_FEED_PATH
    cursor = conn.execute("SELECT config FROM connectors WHERE id = ?", (connector_id,))
    row = cursor.fetchone()
    config = json.loads(row["config"]) if row and row["config"] else {}
    processed_ids = set(config.get("processed_message_ids") or [])

    total_inserted = 0
    total_noise = 0
    channels_used: set[str] = set()

    if not path.exists():
        logger.warning("Simulated feed file not found: %s", path)
        return 0, 0

    raw = path.read_text(encoding="utf-8")
    messages = json.loads(raw) if raw.strip() else []
    if not isinstance(messages, list):
        messages = []

    new_messages = [m for m in messages if m.get("id") and m["id"] not in processed_ids]

    for msg in new_messages:
        text = (msg.get("text") or "").strip()
        if not text or len(text) < 2:
            processed_ids.add(msg["id"])
            continue
        inserted, noise = await process_single_message(
            conn,
            org_id,
            text=text,
            source="slack",
            author_name=msg.get("user"),
            created_at=msg.get("timestamp"),
            ingestion_method="mcp_slack",
        )
        total_inserted += inserted
        total_noise += noise
        if msg.get("channel"):
            channels_used.add(msg["channel"])
        processed_ids.add(msg["id"])

    # Cap stored ids to avoid huge config
    processed_list = list(processed_ids)[-MAX_PROCESSED_IDS:]
    config["processed_message_ids"] = processed_list
    config_str = json.dumps(config)

    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    channel_detail = ", ".join(sorted(channels_used)) if channels_used else None

    conn.execute(
        """UPDATE connectors SET config = ?, last_sync_at = ?, messages_processed = messages_processed + ?,
           noise_filtered = noise_filtered + ?, last_error = NULL, updated_at = ? WHERE id = ?""",
        (config_str, now, total_inserted + total_noise, total_noise, now, connector_id),
    )
    if total_inserted + total_noise > 0:
        history_id = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO connector_sync_history
               (id, connector_id, event_type, messages_count, noise_filtered, channel_or_detail, created_at)
               VALUES (?, ?, 'sync', ?, ?, ?, ?)""",
            (history_id, connector_id, total_inserted + total_noise, total_noise, channel_detail, now),
        )
    conn.commit()

    if total_inserted + total_noise > 0:
        logger.info(
            "Simulated MCP: connector %s processed %d messages (%d noise)",
            connector_id[:8],
            total_inserted + total_noise,
            total_noise,
        )
    return total_inserted + total_noise, total_noise


async def poll_simulated_feed(
    conn: Any,
    org_id: str,
    connector_id: str,
    interval_seconds: int,
    feed_path: Path | None = None,
) -> None:
    """Background task: poll feed at interval, process new messages, update connector and history."""
    while True:
        try:
            await _do_one_poll_cycle(conn, org_id, connector_id, feed_path)
        except asyncio.CancelledError:
            logger.info("Simulated poll stopped for connector %s", connector_id[:8])
            break
        except Exception as e:
            logger.exception("Simulated MCP error for connector %s: %s", connector_id[:8], e)
            try:
                conn.execute(
                    """UPDATE connectors SET last_error = ?, updated_at = datetime('now') WHERE id = ?""",
                    (str(e)[:500], connector_id),
                )
                conn.commit()
            except Exception:
                pass
        await asyncio.sleep(interval_seconds)
