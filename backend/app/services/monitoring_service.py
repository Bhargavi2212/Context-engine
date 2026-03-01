"""Agent monitoring: log agent calls and return stats for Settings > System Status."""
import uuid
from typing import Any


def log_agent_call(
    conn: Any,
    org_id: str,
    agent_type: str,
    tool_used: str,
    latency_ms: int,
    model: str = "mistral",
    tokens_in: int = 0,
    tokens_out: int = 0,
) -> None:
    """Insert one row into agent_logs. Call after each agent completion."""
    log_id = str(uuid.uuid4())
    conn.execute(
        """INSERT INTO agent_logs (id, org_id, agent_type, tool_used, latency_ms, model, tokens_in, tokens_out)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (log_id, org_id, agent_type or "general", tool_used or "chat", latency_ms, model, tokens_in, tokens_out),
    )
    conn.commit()


def get_agent_stats(conn: Any, org_id: str) -> dict[str, Any]:
    """Return aggregates and recent activity for GET /monitoring/agent-stats."""
    totals = conn.execute(
        """SELECT COUNT(*) AS total_calls, AVG(latency_ms) AS avg_latency_ms
           FROM agent_logs WHERE org_id = ?""",
        (org_id,),
    ).fetchone()
    total_calls = totals["total_calls"] or 0
    avg_latency_ms = totals["avg_latency_ms"]
    if avg_latency_ms is not None:
        avg_latency_ms = round(float(avg_latency_ms), 0)

    tool_counts = conn.execute(
        """SELECT tool_used, COUNT(*) AS cnt FROM agent_logs WHERE org_id = ? GROUP BY tool_used ORDER BY cnt DESC""",
        (org_id,),
    ).fetchall()
    tool_counts_dict = {row["tool_used"] or "chat": row["cnt"] for row in tool_counts}
    most_used_tool = tool_counts[0]["tool_used"] if tool_counts else "chat"

    model_counts = conn.execute(
        """SELECT model, COUNT(*) AS cnt FROM agent_logs WHERE org_id = ? GROUP BY model""",
        (org_id,),
    ).fetchall()
    total_for_pct = sum(r["cnt"] for r in model_counts) or 1
    model_usage = {r["model"] or "mistral": round(100 * (r["cnt"] / total_for_pct), 1) for r in model_counts}

    recent = conn.execute(
        """SELECT agent_type, tool_used, latency_ms, model, created_at
           FROM agent_logs WHERE org_id = ? ORDER BY created_at DESC LIMIT 10""",
        (org_id,),
    ).fetchall()
    recent_activity = [
        {
            "agent_type": r["agent_type"],
            "tool_used": r["tool_used"],
            "latency_ms": r["latency_ms"],
            "model": r["model"],
            "created_at": r["created_at"],
        }
        for r in recent
    ]

    return {
        "total_calls": total_calls,
        "avg_latency_ms": avg_latency_ms,
        "tool_counts": tool_counts_dict,
        "most_used_tool": most_used_tool,
        "model_usage": model_usage,
        "recent_activity": recent_activity,
    }
