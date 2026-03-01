"""Customer service: CRUD and bulk import."""
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from app.services.csv_service import parse_csv, rows_to_dicts
from app.services.upload_service import get_upload_temp_path, update_upload_result, cleanup_temp


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def _to_int(v: Any) -> int | None:
    if v is None:
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def import_customers_csv(
    conn: Any,
    upload_id: str,
    column_mapping: dict[str, str],
    org_id: str,
) -> dict[str, Any]:
    """Import customers from CSV. Validates company_name is required. Returns summary."""
    if "company_name" not in column_mapping or not column_mapping["company_name"]:
        raise ValueError("company_name column mapping is required")

    path_str = get_upload_temp_path(conn, upload_id)
    if not path_str or not Path(path_str).exists():
        raise ValueError("CSV file no longer available")
    content = Path(path_str).read_bytes()
    parsed = parse_csv(content, "upload.csv")
    columns = parsed["columns"]
    rows = parsed["rows"]
    mapping = {k: v for k, v in column_mapping.items() if v}
    items = rows_to_dicts(columns, rows, mapping)

    segments: dict[str, int] = {}
    total_arr = 0.0
    imported = 0

    for it in items:
        company_name = (it.get("company_name") or "").strip()
        if not company_name:
            continue
        customer_id = str(uuid.uuid4())
        mrr = _to_float(it.get("mrr")) or 0.0
        arr = _to_float(it.get("arr")) or (mrr * 12 if mrr else 0.0)
        segment = (it.get("segment") or "unknown").lower()
        segments[segment] = segments.get(segment, 0) + 1
        total_arr += arr

        conn.execute(
            """INSERT INTO customers (
                id, org_id, company_name, segment, plan, mrr, arr,
                account_manager, renewal_date, health_score, industry, employee_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                customer_id,
                org_id,
                company_name,
                it.get("segment"),
                it.get("plan"),
                mrr,
                arr,
                it.get("account_manager"),
                it.get("renewal_date"),
                _to_int(it.get("health_score")),
                it.get("industry"),
                _to_int(it.get("employee_count")),
            ),
        )
        imported += 1

    conn.commit()
    result_data = {"count": imported, "segments": segments, "total_arr": total_arr}
    update_upload_result(conn, upload_id, imported, len(items) - imported, result_data, "completed")
    cleanup_temp(conn, upload_id)
    return result_data


def create_customer(conn: Any, data: dict[str, Any], org_id: str) -> dict[str, Any]:
    """Create single customer."""
    company_name = (data.get("company_name") or "").strip()
    if not company_name:
        raise ValueError("company_name is required")
    mrr = _to_float(data.get("mrr")) or 0.0
    arr = _to_float(data.get("arr")) or (mrr * 12 if mrr else 0.0)
    customer_id = str(uuid.uuid4())
    conn.execute(
        """INSERT INTO customers (
            id, org_id, company_name, segment, plan, mrr, arr,
            account_manager, renewal_date, health_score, industry, employee_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            customer_id,
            org_id,
            company_name,
            data.get("segment"),
            data.get("plan"),
            mrr,
            arr,
            data.get("account_manager"),
            data.get("renewal_date"),
            _to_int(data.get("health_score")) or 50,
            data.get("industry"),
            _to_int(data.get("employee_count")),
        ),
    )
    conn.commit()
    cursor = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    return dict(cursor.fetchone())


def list_customers(
    conn: Any,
    org_id: str,
    search: str | None = None,
    segment: str | None = None,
    health_min: int | None = None,
    health_max: int | None = None,
    renewal_before: str | None = None,
    renewal_within_days: int | None = None,
    page: int = 1,
    per_page: int = 20,
    sort_by: str | None = None,
    sort_order: str = "asc",
) -> tuple[list[dict[str, Any]], int]:
    """List customers with filters and pagination. Returns (items, total)."""
    conditions = ["org_id = ?"]
    params: list[Any] = [org_id]
    if search:
        conditions.append("company_name LIKE ?")
        params.append(f"%{search}%")
    if segment:
        conditions.append("segment = ?")
        params.append(segment)
    if health_min is not None:
        conditions.append("health_score >= ?")
        params.append(health_min)
    if health_max is not None:
        conditions.append("health_score <= ?")
        params.append(health_max)
    if renewal_before:
        conditions.append("renewal_date <= ?")
        params.append(renewal_before)
    if renewal_within_days is not None and renewal_within_days >= 0:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        end_date = (datetime.utcnow() + timedelta(days=renewal_within_days)).strftime("%Y-%m-%d")
        conditions.append("renewal_date >= ?")
        params.append(today)
        conditions.append("renewal_date <= ?")
        params.append(end_date)

    where = " AND ".join(conditions)
    # Total = distinct companies (dedupe so duplicate uploads don't double-count)
    cursor = conn.execute(
        f"SELECT COUNT(*) AS c FROM (SELECT 1 FROM customers WHERE {where} GROUP BY org_id, company_name)",
        params,
    )
    total = cursor.fetchone()["c"]
    offset = (page - 1) * per_page

    order_col = "company_name"
    if sort_by == "arr":
        order_col = "arr"
    elif sort_by == "health_score":
        order_col = "health_score"
    elif sort_by == "renewal_date":
        order_col = "renewal_date"
    elif sort_by == "feedback_count":
        order_col = "feedback_count"
    elif sort_by == "avg_sentiment":
        order_col = "avg_sentiment"
    elif sort_by == "segment":
        order_col = "segment"
    elif sort_by == "plan":
        order_col = "plan"
    order_dir = "DESC" if sort_order.lower() == "desc" else "ASC"

    # One row per company: pick customer id with most feedback, aggregate feedback_count and avg_sentiment across all dupes
    cursor = conn.execute(
        f"""WITH ranked AS (
            SELECT c.id, c.org_id, c.company_name, c.segment, c.arr, c.health_score, c.renewal_date, c.account_manager, c.plan,
                   (SELECT COUNT(*) FROM feedback f WHERE f.customer_id = c.id AND f.org_id = c.org_id) AS fc,
                   ROW_NUMBER() OVER (PARTITION BY c.org_id, c.company_name ORDER BY (SELECT COUNT(*) FROM feedback f WHERE f.customer_id = c.id AND f.org_id = c.org_id) DESC, c.id) AS rn
            FROM customers c WHERE {where}
            )
            SELECT r.id, r.org_id, r.company_name, r.segment, r.arr, r.health_score, r.renewal_date, r.account_manager, r.plan,
                   (SELECT COUNT(*) FROM feedback f INNER JOIN customers c2 ON c2.id = f.customer_id AND c2.org_id = f.org_id WHERE c2.org_id = r.org_id AND c2.company_name = r.company_name) AS feedback_count,
                   (SELECT COALESCE(AVG(f.sentiment_score), 0) FROM feedback f INNER JOIN customers c2 ON c2.id = f.customer_id AND c2.org_id = f.org_id WHERE c2.org_id = r.org_id AND c2.company_name = r.company_name AND f.sentiment_score IS NOT NULL) AS avg_sentiment
            FROM ranked r WHERE r.rn = 1
            ORDER BY {order_col} {order_dir} LIMIT ? OFFSET ?""",
        params + [per_page, offset],
    )
    rows = [dict(row) for row in cursor.fetchall()]
    for r in rows:
        if "avg_sentiment" in r and r["avg_sentiment"] is not None:
            r["avg_sentiment"] = round(float(r["avg_sentiment"]), 4)
    return rows, total


def list_customer_feedback(
    conn: Any,
    org_id: str,
    customer_id: str,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict[str, Any]], int]:
    """List feedback linked to a customer (or any customer with same company_name for deduped list), sorted by date desc, paginated."""
    customer_ids = _customer_ids_for_company(conn, org_id, customer_id)
    if not customer_ids:
        return [], 0
    placeholders = ",".join("?" * len(customer_ids))
    where = f"org_id = ? AND customer_id IN ({placeholders})"
    params: list[Any] = [org_id] + customer_ids
    cursor = conn.execute(f"SELECT COUNT(*) AS c FROM feedback WHERE {where}", params)
    total = cursor.fetchone()["c"]
    offset = (page - 1) * per_page
    cursor = conn.execute(
        f"SELECT * FROM feedback WHERE {where} ORDER BY COALESCE(ingested_at, created_at) DESC LIMIT ? OFFSET ?",
        params + [per_page, offset],
    )
    rows = [dict(r) for r in cursor.fetchall()]
    for r in rows:
        r.pop("embedding", None)
    return rows, total


def _customer_ids_for_company(conn: Any, org_id: str, customer_id: str) -> list[str]:
    """Return list of customer ids with same company_name (for deduped view)."""
    cursor = conn.execute(
        "SELECT company_name FROM customers WHERE id = ? AND org_id = ?", (customer_id, org_id)
    )
    row = cursor.fetchone()
    if not row:
        return []
    cursor = conn.execute(
        "SELECT id FROM customers WHERE org_id = ? AND company_name = ?",
        (org_id, row["company_name"]),
    )
    return [r["id"] for r in cursor.fetchall()]


def get_customer_stats(conn: Any, org_id: str, customer_id: str) -> dict[str, Any] | None:
    """Customer stats: total_feedback, sentiment_breakdown, avg_sentiment_score, top_areas, recent_trend, first/last feedback dates. Uses all feedback for same company_name (deduped)."""
    cids = _customer_ids_for_company(conn, org_id, customer_id)
    if not cids:
        return None
    ph = ",".join("?" * len(cids))
    params: list[Any] = [org_id] + cids
    cursor = conn.execute(
        f"""SELECT COUNT(*) AS total, AVG(sentiment_score) AS avg_sent
           FROM feedback WHERE org_id = ? AND customer_id IN ({ph})""",
        params,
    )
    row = cursor.fetchone()
    if not row or row["total"] == 0:
        return {
            "total_feedback": 0,
            "sentiment_breakdown": {},
            "avg_sentiment_score": 0.0,
            "top_areas": [],
            "recent_trend": "unknown",
            "first_feedback_date": None,
            "last_feedback_date": None,
        }

    total = row["total"]
    avg_sent = float(row["avg_sent"] or 0)

    cursor = conn.execute(
        f"""SELECT sentiment, COUNT(*) AS c FROM feedback WHERE org_id = ? AND customer_id IN ({ph}) AND sentiment IS NOT NULL GROUP BY sentiment""",
        params,
    )
    sentiment_breakdown = {r["sentiment"]: r["c"] for r in cursor.fetchall()}

    cursor = conn.execute(
        f"""SELECT feature_area FROM feedback WHERE org_id = ? AND customer_id IN ({ph}) AND feature_area IS NOT NULL AND feature_area != ''
           GROUP BY feature_area ORDER BY COUNT(*) DESC LIMIT 5""",
        params,
    )
    top_areas = [r["feature_area"] for r in cursor.fetchall()]

    cursor = conn.execute(
        f"""SELECT MIN(COALESCE(ingested_at, created_at)) AS first_d, MAX(COALESCE(ingested_at, created_at)) AS last_d
           FROM feedback WHERE org_id = ? AND customer_id IN ({ph})""",
        params,
    )
    dr = cursor.fetchone()
    first_d = dr["first_d"]
    last_d = dr["last_d"]

    recent_trend = "unknown"
    if total >= 2 and first_d and last_d:
        cursor = conn.execute(
            f"""SELECT AVG(sentiment_score) AS avg_sent FROM feedback WHERE org_id = ? AND customer_id IN ({ph})
               AND (COALESCE(ingested_at, created_at) >= date('now', '-30 days'))""",
            params,
        )
        recent_avg = cursor.fetchone()
        if recent_avg and recent_avg["avg_sent"] is not None:
            recent_sent = float(recent_avg["avg_sent"])
            if recent_sent < avg_sent - 0.1:
                recent_trend = "worsening"
            elif recent_sent > avg_sent + 0.1:
                recent_trend = "improving"
            else:
                recent_trend = "stable"

    return {
        "total_feedback": total,
        "sentiment_breakdown": sentiment_breakdown,
        "avg_sentiment_score": round(avg_sent, 4),
        "top_areas": top_areas,
        "recent_trend": recent_trend,
        "first_feedback_date": first_d[:10] if first_d else None,
        "last_feedback_date": last_d[:10] if last_d else None,
    }


def get_customer_sentiment_trend(conn: Any, org_id: str, customer_id: str) -> list[dict[str, Any]]:
    """Time-series periods for sentiment chart: [{ date, avg_sentiment, count }]. Uses all feedback for same company_name."""
    cids = _customer_ids_for_company(conn, org_id, customer_id)
    if not cids:
        return []
    ph = ",".join("?" * len(cids))
    params: list[Any] = [org_id] + cids
    cursor = conn.execute(
        f"""SELECT date(COALESCE(ingested_at, created_at)) AS d, AVG(sentiment_score) AS avg_sent, COUNT(*) AS cnt
           FROM feedback WHERE org_id = ? AND customer_id IN ({ph}) AND (ingested_at IS NOT NULL OR created_at IS NOT NULL)
           GROUP BY date(COALESCE(ingested_at, created_at)) ORDER BY d""",
        params,
    )
    return [
        {
            "date": r["d"][:10] if r["d"] else None,
            "avg_sentiment": round(float(r["avg_sent"] or 0), 4),
            "count": r["cnt"],
        }
        for r in cursor.fetchall()
    ]


def get_customer(conn: Any, org_id: str, customer_id: str) -> dict[str, Any] | None:
    """Get single customer with feedback count and avg sentiment."""
    cursor = conn.execute(
        """SELECT c.*,
            (SELECT COUNT(*) FROM feedback f WHERE f.customer_id = c.id AND f.org_id = c.org_id) AS feedback_count,
            (SELECT COALESCE(AVG(f.sentiment_score), 0) FROM feedback f WHERE f.customer_id = c.id AND f.org_id = c.org_id AND f.sentiment_score IS NOT NULL) AS avg_sentiment
           FROM customers c WHERE c.id = ? AND c.org_id = ?""",
        (customer_id, org_id),
    )
    row = cursor.fetchone()
    if not row:
        return None
    d = dict(row)
    if "avg_sentiment" in d and d["avg_sentiment"] is not None:
        d["avg_sentiment"] = round(float(d["avg_sentiment"]), 4)
    return d


def delete_customer(conn: Any, org_id: str, customer_id: str) -> bool:
    """Delete a customer. Unlinks their feedback (sets customer_id to NULL). Returns True if deleted."""
    cursor = conn.execute(
        "UPDATE feedback SET customer_id = NULL, customer_name = NULL, customer_segment = NULL WHERE org_id = ? AND customer_id = ?",
        (org_id, customer_id),
    )
    cursor = conn.execute(
        "DELETE FROM customers WHERE id = ? AND org_id = ?",
        (customer_id, org_id),
    )
    conn.commit()
    return cursor.rowcount > 0


def merge_duplicate_customers(conn: Any, org_id: str) -> dict[str, Any]:
    """For each company_name with multiple rows, keep the customer that has the most feedback; reassign all feedback to that id; delete the other rows. Returns { merged_count, deleted_count }."""
    cursor = conn.execute(
        """SELECT company_name, id,
            (SELECT COUNT(*) FROM feedback f WHERE f.customer_id = customers.id AND f.org_id = customers.org_id) AS fc
           FROM customers WHERE org_id = ? ORDER BY company_name, fc DESC, id""",
        (org_id,),
    )
    rows = list(cursor.fetchall())
    by_company: dict[str, list[tuple[str, int]]] = {}
    for r in rows:
        name = (r["company_name"] or "").strip()
        if not name:
            continue
        if name not in by_company:
            by_company[name] = []
        by_company[name].append((r["id"], r["fc"] or 0))
    merged_count = 0
    deleted_count = 0
    for company_name, id_list in by_company.items():
        if len(id_list) <= 1:
            continue
        keep_id = id_list[0][0]
        for cid, _ in id_list[1:]:
            conn.execute(
                "UPDATE feedback SET customer_id = ?, customer_name = ? WHERE org_id = ? AND customer_id = ?",
                (keep_id, company_name, org_id, cid),
            )
            cursor = conn.execute("DELETE FROM customers WHERE id = ? AND org_id = ?", (cid, org_id))
            deleted_count += cursor.rowcount
        merged_count += 1
    conn.commit()
    return {"merged_count": merged_count, "deleted_count": deleted_count}
