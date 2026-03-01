"""Live Slack MCP: spawn @modelcontextprotocol/server-slack via stdio, fetch channel history, process messages."""
import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Any

from app.services.feedback_service import process_single_message

logger = logging.getLogger(__name__)

# Processed message keys: "channel_id:ts" to avoid reprocessing
MAX_PROCESSED_KEYS = 2000


def _parse_tool_text(result: Any) -> str | None:
    """Extract text from MCP call_tool result (content[0].text or similar)."""
    if not result or not getattr(result, "content", None):
        return None
    content = result.content
    if not content:
        return None
    first = content[0]
    if hasattr(first, "text"):
        return getattr(first, "text", None)
    if isinstance(first, dict) and "text" in first:
        return first["text"]
    return None


async def _fetch_messages_via_mcp(
    slack_bot_token: str,
    slack_team_id: str,
    channel_ids: list[str],
    limit_per_channel: int = 50,
) -> list[dict[str, Any]]:
    """Spawn Slack MCP server, call slack_get_channel_history for each channel. Returns list of message dicts."""
    try:
        from mcp import ClientSession
        from mcp.client.stdio import StdioServerParameters, stdio_client
    except ImportError as e:
        raise RuntimeError("MCP client not installed. Install with: pip install mcp") from e

    env = {
        "SLACK_BOT_TOKEN": slack_bot_token,
        "SLACK_TEAM_ID": slack_team_id,
    }
    if channel_ids:
        env["SLACK_CHANNEL_IDS"] = ",".join(channel_ids)

    server_params = StdioServerParameters(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-slack"],
        env=env,
    )
    all_messages: list[dict[str, Any]] = []

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for ch_id in channel_ids:
                try:
                    result = await session.call_tool(
                        "slack_get_channel_history",
                        arguments={"channel_id": ch_id, "limit": limit_per_channel},
                    )
                    text = _parse_tool_text(result)
                    if not text:
                        continue
                    data = json.loads(text) if text.strip().startswith("[") or text.strip().startswith("{") else None
                    if isinstance(data, list):
                        for m in data:
                            m["_channel_id"] = ch_id
                            all_messages.append(m)
                    elif isinstance(data, dict) and "messages" in data:
                        for m in data["messages"]:
                            m["_channel_id"] = ch_id
                            all_messages.append(m)
                    else:
                        # Try parsing as lines or single message
                        try:
                            obj = json.loads(text)
                            if isinstance(obj, dict) and "messages" in obj:
                                for m in obj["messages"]:
                                    m["_channel_id"] = ch_id
                                    all_messages.append(m)
                            elif isinstance(obj, dict):
                                obj["_channel_id"] = ch_id
                                all_messages.append(obj)
                        except json.JSONDecodeError:
                            pass
                except Exception as e:
                    logger.warning("Slack MCP slack_get_channel_history for %s failed: %s", ch_id, e)
    return all_messages


def _normalize_message(msg: dict[str, Any]) -> tuple[str, str, str | None, str | None]:
    """Return (channel_id, ts, text, user) for a Slack message."""
    ch = msg.get("_channel_id") or msg.get("channel") or msg.get("channel_id") or ""
    ts = msg.get("ts") or msg.get("timestamp") or ""
    if isinstance(ts, (int, float)):
        ts = str(ts)
    text = msg.get("text") or msg.get("message", {}).get("text") if isinstance(msg.get("message"), dict) else ""
    if not isinstance(text, str):
        text = str(text) if text else ""
    user = msg.get("user") or msg.get("user_id") or msg.get("message", {}).get("user") if isinstance(msg.get("message"), dict) else None
    return ch, ts, (text or "").strip(), user


async def _do_one_live_cycle(
    conn: Any,
    org_id: str,
    connector_id: str,
    config: dict[str, Any],
) -> tuple[int, int]:
    """Run one fetch/process cycle for live Slack. Returns (messages_processed, noise_count)."""
    token = (config.get("slack_bot_token") or "").strip()
    team_id = (config.get("slack_team_id") or "").strip()
    channel_ids = config.get("channel_ids") or config.get("channels") or []
    if isinstance(channel_ids, str):
        channel_ids = [c.strip() for c in channel_ids.split(",") if c.strip()]
    if not token or not team_id:
        raise ValueError("slack_bot_token and slack_team_id are required")
    if not channel_ids:
        # Optional: call slack_list_channels and use first N? For now require channel_ids.
        raise ValueError("At least one channel_id is required for live Slack")

    processed_keys = set(config.get("processed_message_keys") or [])
    messages = await _fetch_messages_via_mcp(token, team_id, channel_ids)
    total_inserted = 0
    total_noise = 0
    channels_used: set[str] = set()

    for msg in messages:
        ch, ts, text, user = _normalize_message(msg)
        key = f"{ch}:{ts}"
        if key in processed_keys:
            continue
        processed_keys.add(key)
        if not text or len(text) < 2:
            continue
        inserted, noise = await process_single_message(
            conn,
            org_id,
            text=text,
            source="slack",
            author_name=user,
            created_at=ts if ts else None,
            ingestion_method="mcp_slack",
        )
        total_inserted += inserted
        total_noise += noise
        if ch:
            channels_used.add(ch)

    processed_list = list(processed_keys)[-MAX_PROCESSED_KEYS:]
    config["processed_message_keys"] = processed_list
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
            "Live Slack MCP: connector %s processed %d messages (%d noise)",
            connector_id[:8],
            total_inserted + total_noise,
            total_noise,
        )
    return total_inserted + total_noise, total_noise


async def poll_live_slack(
    conn: Any,
    org_id: str,
    connector_id: str,
    interval_seconds: int,
) -> None:
    """Background task: poll live Slack at interval via MCP, process new messages, update connector and history."""
    while True:
        try:
            row = conn.execute("SELECT config FROM connectors WHERE id = ?", (connector_id,)).fetchone()
            if not row or not row["config"]:
                break
            config = json.loads(row["config"])
            await _do_one_live_cycle(conn, org_id, connector_id, config)
        except asyncio.CancelledError:
            logger.info("Live Slack poll stopped for connector %s", connector_id[:8])
            break
        except Exception as e:
            logger.exception("Live Slack MCP error for connector %s: %s", connector_id[:8], e)
            try:
                conn.execute(
                    """UPDATE connectors SET last_error = ?, updated_at = datetime('now') WHERE id = ?""",
                    (str(e)[:500], connector_id),
                )
                conn.commit()
            except Exception:
                pass
        await asyncio.sleep(interval_seconds)
