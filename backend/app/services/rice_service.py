"""RICE scoring service: compute Reach × Impact × Confidence / Effort per feature area."""
import json
from typing import Any

_DATE_COL = "COALESCE(ingested_at, created_at)"


def calculate_rice_scores(conn: Any, org_id: str) -> list[dict[str, Any]]:
    """Calculate RICE scores for all feature areas with negative feedback.
    Returns list of dicts sorted by rice_score descending.
    """
    totals = conn.execute(
        """
        SELECT
            COUNT(DISTINCT customer_id) AS total_customers,
            COUNT(*) AS total_feedback
        FROM feedback
        WHERE org_id = ? AND is_feedback = 1
        """,
        (org_id,),
    ).fetchone()
    total_customers = max(totals["total_customers"] or 0, 1)
    total_feedback = max(totals["total_feedback"] or 0, 1)

    total_arr_row = conn.execute(
        "SELECT SUM(arr) AS total_arr FROM customers WHERE org_id = ?",
        (org_id,),
    ).fetchone()
    total_arr = max(float(total_arr_row["total_arr"] or 0), 1.0)

    issues = conn.execute(
        """
        SELECT
            feature_area,
            COUNT(*) AS feedback_count,
            COUNT(DISTINCT customer_id) AS unique_customers,
            AVG(sentiment_score) AS avg_sentiment,
            SUM(CASE WHEN urgency = 'critical' THEN 1 ELSE 0 END) AS critical_count,
            SUM(CASE WHEN urgency = 'high' THEN 1 ELSE 0 END) AS high_count,
            AVG(confidence) AS avg_confidence
        FROM feedback
        WHERE org_id = ? AND is_feedback = 1 AND sentiment = 'negative'
            AND feature_area IS NOT NULL AND feature_area != ''
        GROUP BY feature_area
        HAVING COUNT(*) >= 2
        ORDER BY feedback_count DESC
        """,
        (org_id,),
    ).fetchall()

    results = []
    for row in issues:
        issue = dict(row)
        arr_row = conn.execute(
            """
            SELECT COALESCE(SUM(c.arr), 0) AS arr_at_risk
            FROM customers c
            INNER JOIN feedback f ON c.id = f.customer_id
            WHERE f.org_id = ? AND f.feature_area = ? AND f.sentiment = 'negative'
            """,
            (org_id, issue["feature_area"]),
        ).fetchone()
        arr_at_risk = float(arr_row["arr_at_risk"] or 0)

        customer_reach = (issue["unique_customers"] or 0) / total_customers * 100
        feedback_reach = (issue["feedback_count"] or 0) / total_feedback * 100
        reach = min((customer_reach + feedback_reach) / 2, 100)

        avg_sent = issue["avg_sentiment"] or 0
        sentiment_severity = abs(avg_sent) * 25
        arr_impact = (arr_at_risk / total_arr) * 50
        urgency_bonus = (issue["critical_count"] or 0) * 10 + (issue["high_count"] or 0) * 5
        urgency_bonus = min(urgency_bonus, 25)
        impact = min(sentiment_severity + arr_impact + urgency_bonus, 100)

        conf_model = (issue["avg_confidence"] or 0.5) * 50
        conf_volume = min((issue["feedback_count"] or 0) * 5, 50)
        confidence = min(conf_model + conf_volume, 100)

        count = issue["feedback_count"] or 0
        if count <= 5:
            effort = 3
        elif count >= 15:
            effort = 1
        else:
            effort = 2

        rice_score = round((reach * impact * confidence) / (effort * 100), 1)
        trend = calculate_trend(conn, org_id, issue["feature_area"])
        related_goal = find_related_goal(conn, org_id, issue["feature_area"])
        team = find_team(conn, org_id, issue["feature_area"])

        results.append({
            "feature_area": issue["feature_area"],
            "rice_score": rice_score,
            "reach": round(reach, 1),
            "impact": round(impact, 1),
            "confidence": round(confidence, 1),
            "effort": effort,
            "feedback_count": count,
            "unique_customers": issue["unique_customers"] or 0,
            "arr_at_risk": arr_at_risk,
            "avg_sentiment": round(avg_sent, 2),
            "trend": trend,
            "team": team,
            "related_goal": related_goal,
        })

    results.sort(key=lambda x: x["rice_score"], reverse=True)
    return results


def calculate_trend(conn: Any, org_id: str, feature_area: str) -> str:
    """Compare last 14 days vs previous 14 days for negative feedback count."""
    recent = conn.execute(
        f"""
        SELECT COUNT(*) AS c FROM feedback
        WHERE org_id = ? AND feature_area = ? AND sentiment = 'negative'
            AND {_DATE_COL} >= datetime('now', '-14 days')
        """,
        (org_id, feature_area),
    ).fetchone()["c"] or 0

    previous = conn.execute(
        f"""
        SELECT COUNT(*) AS c FROM feedback
        WHERE org_id = ? AND feature_area = ? AND sentiment = 'negative'
            AND {_DATE_COL} >= datetime('now', '-28 days')
            AND {_DATE_COL} < datetime('now', '-14 days')
        """,
        (org_id, feature_area),
    ).fetchone()["c"] or 0

    if previous == 0:
        return "new" if recent > 0 else "stable"
    change = (recent - previous) / previous
    if change > 0.2:
        return "worsening"
    if change < -0.2:
        return "improving"
    return "stable"


def find_related_goal(conn: Any, org_id: str, feature_area: str) -> str | None:
    """Find a business goal related to this feature area from product_context."""
    rows = conn.execute(
        "SELECT data FROM product_context WHERE org_id = ? AND section = 'business_goal'",
        (org_id,),
    ).fetchall()
    fa_lower = (feature_area or "").lower()
    for row in rows:
        try:
            goal_data = json.loads(row["data"] or "{}")
        except (TypeError, json.JSONDecodeError):
            continue
        linked = (goal_data.get("linked_area") or "").lower()
        if linked and linked in fa_lower:
            priority = goal_data.get("priority", "P2")
            title = goal_data.get("title", "?")
            return f"[{priority}] {title}"
    return None


def find_team(conn: Any, org_id: str, feature_area: str) -> str | None:
    """Find the team that owns this feature area from product_context."""
    rows = conn.execute(
        "SELECT data FROM product_context WHERE org_id = ? AND section = 'team'",
        (org_id,),
    ).fetchall()
    fa_lower = (feature_area or "").lower()
    for row in rows:
        try:
            team_data = json.loads(row["data"] or "{}")
        except (TypeError, json.JSONDecodeError):
            continue
        owns = team_data.get("owns_areas")
        if isinstance(owns, list):
            if any(fa_lower in (a or "").lower() for a in owns):
                return team_data.get("name")
        elif isinstance(owns, str) and fa_lower in owns.lower():
            return team_data.get("name")
    return None
