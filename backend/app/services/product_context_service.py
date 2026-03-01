"""Product context service: CRUD and bulk save for wizard data.

Uses sync DB via conn. For product_area, preserves order field.
"""
import json
import uuid
from typing import Any

from app.schemas.product_context import WIZARD_SECTIONS


def _json_dumps(obj: dict[str, Any]) -> str:
    return json.dumps(obj) if obj is not None else "{}"


def get_all_for_org(conn: Any, org_id: str) -> dict[str, Any]:
    """Get all product context for org, shaped for frontend prefill.

    Returns: { product_basics: {...}, product_area: [{id, data}], ... }
    product_basics is a single object; list sections are arrays of {id, data}.
    product_area items sorted by order field if present, else created_at.
    """
    cursor = conn.execute(
        "SELECT id, section, data, created_at, updated_at FROM product_context WHERE org_id = ?",
        (org_id,),
    )
    rows = cursor.fetchall()
    result: dict[str, Any] = {
        "product_basics": {},
        "product_area": [],
        "business_goal": [],
        "customer_segment": [],
        "pricing_tier": [],
        "competitor": [],
        "roadmap_existing": [],
        "roadmap_planned": [],
        "team": [],
        "tech_stack": [],
    }
    by_section: dict[str, list[dict[str, Any]]] = {}

    for row in rows:
        rid = row["id"]
        section = row["section"]
        data_str = row["data"]
        created_at = row["created_at"]
        updated_at = row["updated_at"]
        try:
            data = json.loads(data_str) if data_str else {}
        except json.JSONDecodeError:
            data = {}

        if section == "product_basics":
            result["product_basics"] = data
        else:
            if section not in by_section:
                by_section[section] = []
            by_section[section].append({"id": rid, "data": data, "created_at": created_at, "updated_at": updated_at})

    for section, items in by_section.items():
        if section == "product_area":
            def _sort_key(x: dict) -> tuple:
                d = x.get("data") or {}
                o = d.get("order")
                if o is not None:
                    return (0, o)
                return (1, x.get("created_at", "") or "")
            items.sort(key=_sort_key)
        result[section] = [{"id": i["id"], "data": i["data"]} for i in items]

    return result


def get_section(conn: Any, org_id: str, section: str) -> Any:
    """Get items for a specific section. Returns list of {id, data} or single object for product_basics."""
    if section not in WIZARD_SECTIONS:
        return None

    if section == "product_basics":
        cursor = conn.execute(
            "SELECT id, section, data, created_at, updated_at FROM product_context WHERE org_id = ? AND section = ?",
            (org_id, section),
        )
        row = cursor.fetchone()
        if not row:
            return None
        try:
            data = json.loads(row["data"]) if row["data"] else {}
        except json.JSONDecodeError:
            data = {}
        return data

    cursor = conn.execute(
        "SELECT id, section, data, created_at, updated_at FROM product_context WHERE org_id = ? AND section = ? ORDER BY created_at",
        (org_id, section),
    )
    rows = cursor.fetchall()
    items = []
    for row in rows:
        try:
            data = json.loads(row["data"]) if row["data"] else {}
        except json.JSONDecodeError:
            data = {}
        items.append({"id": row["id"], "data": data})

    if section == "product_area":
        items.sort(key=lambda x: (x.get("data") or {}).get("order", 999))

    return items


def create_item(conn: Any, org_id: str, section: str, data: dict[str, Any]) -> dict[str, Any]:
    """Create a single product context item. Returns created row."""
    if section not in WIZARD_SECTIONS:
        raise ValueError(f"Invalid section: {section}")

    item_id = str(uuid.uuid4())
    data_json = _json_dumps(data)
    conn.execute(
        "INSERT INTO product_context (id, org_id, section, data, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        (item_id, org_id, section, data_json),
    )
    conn.commit()
    return {"id": item_id, "org_id": org_id, "section": section, "data": data}


def update_item(conn: Any, org_id: str, item_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    """Update a single product context item. Returns updated row or None if not found."""
    cursor = conn.execute(
        "SELECT id, section FROM product_context WHERE id = ? AND org_id = ?",
        (item_id, org_id),
    )
    row = cursor.fetchone()
    if not row:
        return None

    data_json = _json_dumps(data)
    conn.execute(
        "UPDATE product_context SET data = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?",
        (data_json, item_id, org_id),
    )
    conn.commit()
    return {"id": item_id, "org_id": org_id, "section": row["section"], "data": data}


def delete_item(conn: Any, org_id: str, item_id: str) -> bool:
    """Delete a single product context item. Returns True if deleted."""
    cursor = conn.execute(
        "DELETE FROM product_context WHERE id = ? AND org_id = ?",
        (item_id, org_id),
    )
    conn.commit()
    return cursor.rowcount > 0


def bulk_save(conn: Any, org_id: str, sections: list[dict[str, Any]]) -> int:
    """Delete all product_context for org, then insert new rows from sections.

    Each section has: section (str), and either data (dict) or items (list of {data}).
    For product_basics: use data. For list sections: use items.
    Empty wizard / Skip and explore: if no meaningful data, insert product_basics: {}
    so has_product_context becomes true.
    Returns count of rows inserted.
    """
    conn.execute("DELETE FROM product_context WHERE org_id = ?", (org_id,))
    count = 0

    for sec in sections:
        section_name = sec.get("section")
        if not section_name:
            continue

        if "data" in sec and sec["data"] is not None:
            # Single object (product_basics)
            data = sec["data"] if isinstance(sec["data"], dict) else {}
            item_id = str(uuid.uuid4())
            data_json = _json_dumps(data)
            conn.execute(
                "INSERT INTO product_context (id, org_id, section, data, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
                (item_id, org_id, section_name, data_json),
            )
            count += 1
        elif "items" in sec and sec["items"]:
            for it in sec["items"]:
                data = it.get("data") if isinstance(it, dict) else {}
                if data is None:
                    data = {}
                item_id = str(uuid.uuid4())
                data_json = _json_dumps(data)
                conn.execute(
                    "INSERT INTO product_context (id, org_id, section, data, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
                    (item_id, org_id, section_name, data_json),
                )
                count += 1

    # If nothing was inserted (empty wizard / all skipped), insert product_basics: {} so has_product_context is true
    if count == 0:
        item_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO product_context (id, org_id, section, data, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
            (item_id, org_id, "product_basics", "{}"),
        )
        count = 1

    conn.commit()
    return count


def get_onboarding_status(conn: Any, org_id: str) -> dict[str, bool]:
    """Compute onboarding status for org."""
    cursor = conn.execute(
        "SELECT COUNT(*) AS c FROM product_context WHERE org_id = ?",
        (org_id,),
    )
    has_product_context = cursor.fetchone()["c"] > 0

    cursor = conn.execute(
        "SELECT COUNT(*) AS c FROM feedback WHERE org_id = ?",
        (org_id,),
    )
    has_feedback = cursor.fetchone()["c"] > 0

    cursor = conn.execute(
        "SELECT COUNT(*) AS c FROM customers WHERE org_id = ?",
        (org_id,),
    )
    has_customers = cursor.fetchone()["c"] > 0

    onboarding_complete = has_product_context and (has_feedback or has_customers)

    return {
        "has_product_context": has_product_context,
        "has_feedback": has_feedback,
        "has_customers": has_customers,
        "onboarding_complete": onboarding_complete,
    }
