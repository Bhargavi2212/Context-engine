"""Spec CRUD and regeneration. Used by spec_writer (save_spec) and specs router."""
import json
import uuid
from typing import Any

from app.agents.spec_chain_state import SpecChainState


def save_spec(conn: Any, org_id: str, result: SpecChainState) -> str:
    """Insert generated spec into specs table. Returns spec id."""
    spec_id = str(uuid.uuid4())
    feedback_ids = result.get("feedback_ids") or []
    customer_ids = result.get("customer_ids") or []
    conn.execute(
        """INSERT INTO specs (id, org_id, topic, status, prd, architecture, rules, plan,
                              feedback_ids, customer_ids, arr_impacted, rice_score)
           VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            spec_id,
            org_id,
            result.get("topic", ""),
            result.get("prd") or "",
            result.get("architecture") or "",
            result.get("rules") or "",
            result.get("plan") or "",
            json.dumps(feedback_ids),
            json.dumps(customer_ids),
            float(result.get("arr_impacted") or 0),
            float(result.get("rice_score") or 0),
        ),
    )
    conn.commit()
    return spec_id


def list_specs(
    conn: Any,
    org_id: str,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
) -> tuple[list[dict], int]:
    """Return (list of spec list items, total count)."""
    offset = (page - 1) * page_size
    where = "org_id = ?"
    params: list = [org_id]
    if status:
        where += " AND status = ?"
        params.append(status)
    cursor = conn.execute(
        f"SELECT COUNT(*) AS total FROM specs WHERE {where}",
        params,
    )
    total = cursor.fetchone()["total"] or 0
    cursor = conn.execute(
        f"""SELECT id, topic, status, arr_impacted, rice_score, feedback_ids, created_at
            FROM specs WHERE {where}
            ORDER BY created_at DESC LIMIT ? OFFSET ?""",
        params + [page_size, offset],
    )
    rows = []
    for row in cursor.fetchall():
        r = dict(row)
        fid = r.get("feedback_ids")
        if isinstance(fid, str):
            try:
                fid = json.loads(fid) if fid else []
            except json.JSONDecodeError:
                fid = []
        r["feedback_count"] = len(fid) if isinstance(fid, list) else 0
        del r["feedback_ids"]
        rows.append(r)
    return (rows, total)


def get_spec(conn: Any, org_id: str, spec_id: str) -> dict | None:
    """Return full spec row or None. feedback_ids and customer_ids as lists."""
    cursor = conn.execute(
        """SELECT id, org_id, topic, status, prd, architecture, rules, plan,
                  feedback_ids, customer_ids, arr_impacted, rice_score, created_at
           FROM specs WHERE id = ? AND org_id = ?""",
        (spec_id, org_id),
    )
    row = cursor.fetchone()
    if not row:
        return None
    r = dict(row)
    for key in ("feedback_ids", "customer_ids"):
        val = r.get(key)
        if isinstance(val, str):
            try:
                r[key] = json.loads(val) if val else []
            except json.JSONDecodeError:
                r[key] = []
    fid = r.get("feedback_ids") or []
    r["feedback_count"] = len(fid) if isinstance(fid, list) else 0
    return r


def update_spec_status(conn: Any, org_id: str, spec_id: str, status: str) -> bool:
    """Update status to draft | final | shared. Returns True if updated."""
    if status not in ("draft", "final", "shared"):
        return False
    cursor = conn.execute(
        "UPDATE specs SET status = ? WHERE id = ? AND org_id = ?",
        (status, spec_id, org_id),
    )
    conn.commit()
    return cursor.rowcount > 0


def delete_spec(conn: Any, org_id: str, spec_id: str) -> bool:
    """Delete spec. Returns True if deleted."""
    cursor = conn.execute("DELETE FROM specs WHERE id = ? AND org_id = ?", (spec_id, org_id))
    conn.commit()
    return cursor.rowcount > 0


def regenerate_spec(
    conn: Any,
    org_id: str,
    spec_id: str,
    product_context: dict,
) -> dict | None:
    """Load spec by id, run spec_chain with same topic, overwrite row. Returns updated spec or None."""
    spec = get_spec(conn, org_id, spec_id)
    if not spec:
        return None
    topic = spec.get("topic", "")
    from app.agents.spec_chain import spec_chain

    spec_state: SpecChainState = {
        "topic": topic,
        "messages": [],
        "org_id": org_id,
        "product_context": product_context,
        "conn": conn,
        "analyst_brief": "",
        "customer_brief": "",
        "prd": "",
        "architecture": "",
        "rules": "",
        "plan": "",
        "feedback_ids": [],
        "customer_ids": [],
        "arr_impacted": 0.0,
        "rice_score": 0.0,
    }
    result = spec_chain.invoke(spec_state)
    feedback_ids = result.get("feedback_ids") or []
    customer_ids = result.get("customer_ids") or []
    conn.execute(
        """UPDATE specs SET topic = ?, prd = ?, architecture = ?, rules = ?, plan = ?,
                            feedback_ids = ?, customer_ids = ?, arr_impacted = ?, rice_score = ?
           WHERE id = ? AND org_id = ?""",
        (
            result.get("topic", topic),
            result.get("prd") or "",
            result.get("architecture") or "",
            result.get("rules") or "",
            result.get("plan") or "",
            json.dumps(feedback_ids),
            json.dumps(customer_ids),
            float(result.get("arr_impacted") or 0),
            float(result.get("rice_score") or 0),
            spec_id,
            org_id,
        ),
    )
    conn.commit()
    return get_spec(conn, org_id, spec_id)
