"""Dashboard service: single function returning all 9 widget payloads for GET /api/v1/dashboard."""
from typing import Any

from app.services.rice_service import calculate_rice_scores


def _date_filter_sql(prefix: str = "f") -> str:
    """SQL snippet for filtering by feedback date. Use with (date_from, date_to) params."""
    col = f"date(COALESCE({prefix}.created_at, {prefix}.ingested_at))"
    return f" AND {col} >= date(?) AND {col} <= date(?)"


def get_dashboard_data(
    conn: Any, org_id: str, date_from: str | None = None, date_to: str | None = None
) -> dict[str, Any]:
    """Return all dashboard widget data in one dict. Read-only; no commit.
    When date_from/date_to are set, filter feedback by that range for summary, volume, sentiment, recent, source, area, segment.
    Target: response in under 2 seconds.
    """
    use_date = date_from and date_to
    extra_where = _date_filter_sql("feedback") if use_date else ""
    params_base = (org_id,) if not use_date else (org_id, date_from, date_to)

    # --- Summary (SQLite-safe aggregates) ---
    row = conn.execute(
        f"""
        SELECT
            SUM(CASE WHEN is_feedback = 1 THEN 1 ELSE 0 END) AS total_feedback,
            SUM(CASE WHEN is_feedback = 0 THEN 1 ELSE 0 END) AS total_noise,
            AVG(CASE WHEN is_feedback = 1 THEN sentiment_score END) AS avg_sentiment
        FROM feedback
        WHERE org_id = ?{extra_where}
        """,
        params_base,
    ).fetchone()
    total_feedback = row["total_feedback"] or 0
    total_noise = row["total_noise"] or 0
    avg_sentiment = row["avg_sentiment"]
    if avg_sentiment is not None:
        avg_sentiment = round(float(avg_sentiment), 2)

    active_customers = conn.execute(
        f"SELECT COUNT(DISTINCT customer_id) AS c FROM feedback WHERE org_id = ? AND is_feedback = 1{extra_where}",
        params_base,
    ).fetchone()["c"] or 0

    open_issues = conn.execute(
        f"""
        SELECT COUNT(DISTINCT feature_area) AS c FROM feedback
        WHERE org_id = ? AND sentiment = 'negative'
          AND feature_area IS NOT NULL AND feature_area != ''{extra_where}
        """,
        params_base,
    ).fetchone()["c"] or 0

    specs_count = conn.execute(
        "SELECT COUNT(*) AS c FROM specs WHERE org_id = ?",
        (org_id,),
    ).fetchone()["c"] or 0

    summary = {
        "total_feedback": total_feedback,
        "total_noise": total_noise,
        "avg_sentiment": avg_sentiment,
        "active_customers": active_customers,
        "open_issues": open_issues,
        "specs_generated": specs_count,
    }

    # --- Volume over time (daily buckets; use created_at so chart reflects feedback date) ---
    vol_extra = _date_filter_sql("f") if use_date else ""
    vol_params = (org_id,) if not use_date else (org_id, date_from, date_to)
    volume_rows = conn.execute(
        f"""
        SELECT
            date(COALESCE(f.created_at, f.ingested_at)) AS day_date,
            COUNT(*) AS count,
            AVG(f.sentiment_score) AS avg_sentiment
        FROM feedback f
        WHERE f.org_id = ? AND f.is_feedback = 1
          AND (f.created_at IS NOT NULL OR f.ingested_at IS NOT NULL){vol_extra}
        GROUP BY day_date
        ORDER BY day_date
        """,
        vol_params,
    ).fetchall()
    volume_over_time = []
    for r in volume_rows:
        sent = r["avg_sentiment"]
        volume_over_time.append({
            "date": r["day_date"] or "",
            "count": r["count"] or 0,
            "sentiment": round(float(sent), 2) if sent is not None else None,
        })

    # --- Sentiment breakdown ---
    sentiment_rows = conn.execute(
        f"SELECT sentiment, COUNT(*) AS count FROM feedback WHERE org_id = ? AND is_feedback = 1{extra_where} GROUP BY sentiment",
        params_base,
    ).fetchall()
    sentiment_breakdown = {"positive": 0, "negative": 0, "neutral": 0}
    for r in sentiment_rows:
        s = (r["sentiment"] or "neutral").lower()
        if s in sentiment_breakdown:
            sentiment_breakdown[s] = r["count"] or 0

    # --- Top issues (RICE) ---
    top_issues_rice = calculate_rice_scores(conn, org_id)[:5]

    # --- At-risk customers (all three criteria) ---
    # Subquery: neg count in last 30 days per customer; renewal in 60 days flag
    at_risk_rows = conn.execute(
        """
        WITH neg_30 AS (
            SELECT customer_id, COUNT(*) AS neg_count
            FROM feedback
            WHERE org_id = ? AND sentiment = 'negative'
              AND datetime(COALESCE(ingested_at, created_at)) >= datetime('now', '-30 days')
              AND customer_id IS NOT NULL
            GROUP BY customer_id
        ),
        cust_candidates AS (
            SELECT c.id, c.company_name, c.arr, c.health_score, c.renewal_date,
                   julianday(c.renewal_date) - julianday('now') AS days_to_renewal,
                   COALESCE(n.neg_count, 0) AS neg_count
            FROM customers c
            LEFT JOIN neg_30 n ON c.id = n.customer_id
            WHERE c.org_id = ?
              AND (
                c.health_score < 50
                OR COALESCE(n.neg_count, 0) >= 3
                OR (c.renewal_date IS NOT NULL AND julianday(c.renewal_date) - julianday('now') <= 60 AND julianday(c.renewal_date) - julianday('now') >= 0 AND COALESCE(n.neg_count, 0) >= 1)
              )
        )
        SELECT * FROM cust_candidates
        ORDER BY arr DESC
        LIMIT 10
        """,
        (org_id, org_id),
    ).fetchall()

    at_risk_customers = []
    for c in at_risk_rows:
        cid = c["id"]
        # Recent sentiment and feedback count from negative in last 30 days
        rec = conn.execute(
            """
            SELECT COUNT(*) AS cnt, AVG(sentiment_score) AS avg_sent
            FROM feedback
            WHERE org_id = ? AND customer_id = ? AND sentiment = 'negative'
              AND datetime(COALESCE(ingested_at, created_at)) >= datetime('now', '-30 days')
            """,
            (org_id, cid),
        ).fetchone()
        feedback_count = rec["cnt"] or 0
        recent_sentiment = rec["avg_sent"]
        if recent_sentiment is not None:
            recent_sentiment = round(float(recent_sentiment), 2)

        # Top complaint: feature_area with most negative feedback in last 30 days for this customer
        top_row = conn.execute(
            """
            SELECT feature_area
            FROM feedback
            WHERE org_id = ? AND customer_id = ? AND sentiment = 'negative'
              AND feature_area IS NOT NULL AND feature_area != ''
              AND datetime(COALESCE(ingested_at, created_at)) >= datetime('now', '-30 days')
            GROUP BY feature_area
            ORDER BY COUNT(*) DESC
            LIMIT 1
            """,
            (org_id, cid),
        ).fetchone()
        top_complaint = top_row["feature_area"] if top_row else None

        days_to_renewal = c["days_to_renewal"]
        if days_to_renewal is not None:
            days_to_renewal = int(days_to_renewal)

        at_risk_customers.append({
            "id": cid,
            "company_name": c["company_name"],
            "arr": float(c["arr"] or 0),
            "health_score": c["health_score"],
            "renewal_date": c["renewal_date"],
            "days_to_renewal": days_to_renewal,
            "recent_sentiment": recent_sentiment,
            "feedback_count": feedback_count,
            "top_complaint": top_complaint,
        })

    # --- Recent feedback ---
    recent_rows = conn.execute(
        f"""
        SELECT id, text, sentiment, feature_area, customer_name,
               COALESCE(ingested_at, created_at) AS created_at
        FROM feedback
        WHERE org_id = ? AND is_feedback = 1{extra_where}
        ORDER BY created_at DESC
        LIMIT 10
        """,
        params_base,
    ).fetchall()
    recent_feedback = []
    for r in recent_rows:
        text = (r["text"] or "")[:80]
        if len(r["text"] or "") > 80:
            text += "…"
        recent_feedback.append({
            "id": r["id"],
            "text": text,
            "sentiment": r["sentiment"],
            "feature_area": r["feature_area"],
            "customer_name": r["customer_name"],
            "created_at": r["created_at"],
        })

    # --- Source distribution ---
    source_rows = conn.execute(
        f"""
        SELECT source, COUNT(*) AS count
        FROM feedback
        WHERE org_id = ? AND is_feedback = 1{extra_where}
        GROUP BY source
        ORDER BY count DESC
        """,
        params_base,
    ).fetchall()
    source_distribution = {}
    for r in source_rows:
        key = r["source"] or "unknown"
        source_distribution[key] = r["count"]

    # --- Area breakdown ---
    area_rows = conn.execute(
        f"""
        SELECT feature_area, COUNT(*) AS count, AVG(sentiment_score) AS sentiment
        FROM feedback
        WHERE org_id = ? AND is_feedback = 1 AND feature_area IS NOT NULL AND feature_area != ''{extra_where}
        GROUP BY feature_area
        ORDER BY count DESC
        """,
        params_base,
    ).fetchall()
    area_breakdown = {}
    for r in area_rows:
        sent = r["sentiment"]
        area_breakdown[r["feature_area"]] = {
            "count": r["count"],
            "sentiment": round(float(sent), 2) if sent is not None else None,
        }

    # --- Segment breakdown: customer count per segment (like Hackathon), plus ARR and optional sentiment from feedback ---
    customer_segment_rows = conn.execute(
        """SELECT segment, COUNT(*) AS count, SUM(arr) AS total_arr
           FROM customers
           WHERE org_id = ? AND segment IS NOT NULL AND segment != ''
           GROUP BY segment""",
        (org_id,),
    ).fetchall()
    segment_breakdown = {}
    for r in customer_segment_rows:
        seg = r["segment"] or "unknown"
        segment_breakdown[seg] = {
            "count": r["count"],
            "sentiment": None,
            "arr": float(r["total_arr"] or 0),
        }
    # Optional: average sentiment per segment from feedback (for display if needed)
    seg_extra = _date_filter_sql("f") if use_date else ""
    seg_params = (org_id,) if not use_date else (org_id, date_from, date_to)
    sentiment_rows = conn.execute(
        f"""
        SELECT COALESCE(f.customer_segment, c.segment) AS segment, AVG(f.sentiment_score) AS sentiment
        FROM feedback f
        LEFT JOIN customers c ON f.customer_id = c.id AND f.org_id = c.org_id
        WHERE f.org_id = ? AND f.is_feedback = 1
          AND (COALESCE(f.customer_segment, c.segment) IS NOT NULL AND COALESCE(f.customer_segment, c.segment) != ''){seg_extra}
        GROUP BY COALESCE(f.customer_segment, c.segment)
        """,
        seg_params,
    ).fetchall()
    for r in sentiment_rows:
        seg = r["segment"] or "unknown"
        if seg in segment_breakdown and r["sentiment"] is not None:
            segment_breakdown[seg]["sentiment"] = round(float(r["sentiment"]), 2)

    return {
        "summary": summary,
        "volume_over_time": volume_over_time,
        "sentiment_breakdown": sentiment_breakdown,
        "top_issues_rice": top_issues_rice,
        "at_risk_customers": at_risk_customers,
        "recent_feedback": recent_feedback,
        "source_distribution": source_distribution,
        "area_breakdown": area_breakdown,
        "segment_breakdown": segment_breakdown,
    }
