"""Analyst agent tools: 7 tools querying SQLite and semantic search."""
import asyncio
from datetime import datetime, timedelta
from typing import Any

from langchain_core.tools import tool

from app.services import feedback_service


def get_analyst_tools(conn: Any, org_id: str, product_context: dict | None = None) -> list:
    """Return list of Analyst tools bound to conn and org_id."""

    def _run_async(coro):
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(coro)
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, coro)
            return future.result()

    @tool
    def search_feedback(
        query: str,
        product_area: str | None = None,
        sentiment: str | None = None,
        limit: int = 10,
    ) -> str:
        """Search customer feedback by topic using semantic search. Use when the PM asks about feedback on a specific topic, feature, or issue. Optionally filter by product_area and sentiment."""
        results = _run_async(
            feedback_service.semantic_search(
                conn, org_id,
                query=query,
                product_area=product_area,
                sentiment=sentiment,
                limit=limit,
            )
        )
        if not results:
            return f"No feedback found matching '{query}'."
        out = f"Search results for '{query}':\n\n"
        for r in results:
            txt = (r.get("text") or "")[:100]
            fid = r.get("id", "")
            out += f"- [{r.get('sentiment', '?')}] {txt}...\n"
            out += f"  ID: {fid} · Area: {r.get('feature_area', '—')} · Customer: {r.get('customer_name', '—')} · Similarity: {r.get('similarity_score', 0):.2f}\n\n"
        out += "End your brief with: Feedback IDs: <comma-separated IDs above>, ARR impacted: $<total>, RICE score: <if from rice_scoring>\n"
        return out

    @tool
    def trend_analysis(product_area: str | None = None, period: str = "30d") -> str:
        """Analyze feedback trends over time. Compare current period volume and sentiment to previous period. Use when PM asks about trends, changes, or whether things are getting better or worse. Period can be '7d', '30d', or '90d'."""
        days = int(period.replace("d", ""))
        now = datetime.utcnow()
        curr_end = now.isoformat()
        curr_start = (now - timedelta(days=days)).isoformat()
        prev_end = curr_start
        prev_start = (now - timedelta(days=2 * days)).isoformat()

        cond = "org_id = ? AND ingested_at IS NOT NULL"
        params_base = [org_id]
        if product_area:
            cond += " AND feature_area = ?"
            params_base.append(product_area)

        cursor = conn.execute(
            f"""SELECT COUNT(*) as c, AVG(sentiment_score) as avg_sent
                FROM feedback WHERE {cond} AND ingested_at >= ? AND ingested_at < ?""",
            params_base + [curr_start, curr_end],
        )
        row = cursor.fetchone()
        curr_count = (dict(row)["c"] or 0) if row else 0
        curr_sent = (dict(row)["avg_sent"] or 0.0) if row else 0.0

        cursor = conn.execute(
            f"""SELECT COUNT(*) as c, AVG(sentiment_score) as avg_sent
                FROM feedback WHERE {cond} AND ingested_at >= ? AND ingested_at < ?""",
            params_base + [prev_start, prev_end],
        )
        row = cursor.fetchone()
        prev_count = (dict(row)["c"] or 0) if row else 0
        prev_sent = (dict(row)["avg_sent"] or 0.0) if row else 0.0

        vol_change = ((curr_count - prev_count) / prev_count * 100) if prev_count else 0
        sent_change = curr_sent - prev_sent

        out = f"Trend Analysis (Last {days} days vs previous {days} days):\n\n"
        out += f"Current period: {curr_count} feedback items, avg sentiment {curr_sent:.2f}\n"
        out += f"Previous period: {prev_count} feedback items, avg sentiment {prev_sent:.2f}\n"
        out += f"Volume change: {vol_change:+.1f}%\n"
        out += f"Sentiment change: {sent_change:+.2f}\n"
        return out

    @tool
    def top_issues(period: str = "30d", limit: int = 5) -> str:
        """Find the most impactful issues from customer feedback, ranked by volume, sentiment severity, and revenue impact. Use when PM asks about top problems, priorities, or what to fix first."""
        days = int(period.replace("d", ""))
        date_cutoff = f"-{days} days"
        cursor = conn.execute(
            """SELECT COALESCE(NULLIF(TRIM(feature_area), ''), 'unknown') as feature_area,
               COUNT(*) as count, COUNT(DISTINCT customer_id) as unique_customers,
               AVG(sentiment_score) as avg_sentiment, GROUP_CONCAT(DISTINCT customer_id) as customer_ids
               FROM feedback WHERE org_id = ? AND is_feedback = 1 AND sentiment = 'negative'
               AND COALESCE(ingested_at, created_at) >= datetime('now', ?)
               GROUP BY COALESCE(NULLIF(TRIM(feature_area), ''), 'unknown')
               ORDER BY count DESC LIMIT ?""",
            (org_id, date_cutoff, limit),
        )
        rows = [dict(r) for r in cursor.fetchall()]
        if not rows:
            return f"No negative feedback found in the last {days} days."

        teams_map = {}
        if product_context:
            for t in (product_context.get("team") or []):
                d = t.get("data") or {}
                owns = d.get("owns_areas") or ""
                for area in (owns if isinstance(owns, list) else [owns]):
                    if area:
                        teams_map[str(area).lower()] = d.get("name", "—")

        out = f"Top Issues (Last {days} Days):\n\n"
        for i, r in enumerate(rows, 1):
            raw_area = r["feature_area"] or "unknown"
            area = "Uncategorized" if raw_area.lower() == "unknown" else raw_area
            cids = (r["customer_ids"] or "").split(",")
            cids = [c.strip() for c in cids if c.strip()]
            total_arr = 0
            if cids:
                placeholders = ",".join("?" * len(cids))
                cr = conn.execute(
                    f"SELECT SUM(arr) as total FROM customers WHERE org_id = ? AND id IN ({placeholders})",
                    [org_id] + cids,
                ).fetchone()
                total_arr = cr["total"] or 0
            team = teams_map.get((area or "").lower(), "—")
            out += f"{i}. {area}\n"
            out += f"   Feedback: {r['count']} items from {r['unique_customers']} customers\n"
            out += f"   ARR at Risk: ${total_arr:,.0f}\n"
            out += f"   Avg Sentiment: {r['avg_sentiment'] or 0:.2f}\n"
            out += f"   Team: {team}\n\n"
        # Append actual feedback IDs and ARR for #1 issue so spec chain can parse metadata
        if rows:
            top = rows[0]
            fa = top.get("feature_area") or "unknown"
            fid_cursor = conn.execute(
                """SELECT id FROM feedback WHERE org_id = ? AND is_feedback = 1 AND sentiment = 'negative'
                   AND COALESCE(NULLIF(TRIM(feature_area), ''), 'unknown') = ?
                   AND COALESCE(ingested_at, created_at) >= datetime('now', ?)
                   ORDER BY COALESCE(ingested_at, created_at) DESC LIMIT 15""",
                (org_id, fa, date_cutoff),
            )
            fids = [row["id"] for row in fid_cursor.fetchall()]
            cids = (top.get("customer_ids") or "").split(",")
            cids = [x.strip() for x in cids if x.strip()]
            arr_val = 0
            if cids:
                ph = ",".join("?" * len(cids))
                arr_row = conn.execute(
                    f"SELECT SUM(arr) as total FROM customers WHERE org_id = ? AND id IN ({ph})",
                    [org_id] + cids,
                ).fetchone()
                arr_val = arr_row["total"] or 0
            reach = top.get("unique_customers") or 0
            impact_val = abs(top.get("avg_sentiment") or 0) * 100 + min(arr_val / 10000, 100)
            confidence = min((top.get("count") or 0) * 10, 100)
            effort = 50
            rice = (reach * impact_val * confidence) / effort if effort else 0
            out += "For spec generation use these exact lines:\n"
            if fids:
                out += f"Feedback IDs: {', '.join(fids)}\n"
            out += f"ARR impacted: ${arr_val:,.0f}\n"
            out += f"RICE score: {rice:.0f}\n"
        return out

    @tool
    def find_similar_feedback(text: str, limit: int = 5) -> str:
        """Find feedback items semantically similar to the given text. Use when PM wants to find related feedback or see if others reported the same issue."""
        results = _run_async(
            feedback_service.semantic_search(conn, org_id, query=text, limit=limit)
        )
        if not results:
            return f"No feedback similar to '{text[:50]}...'"
        out = f"Feedback similar to your query:\n\n"
        for r in results:
            txt = (r.get("text") or "")[:120]
            out += f"- {txt}...\n"
            out += f"  Sentiment: {r.get('sentiment', '—')} · Area: {r.get('feature_area', '—')} · Similarity: {r.get('similarity_score', 0):.2f}\n\n"
        return out

    @tool
    def compare_segments(
        segment_a: str = "enterprise",
        segment_b: str = "smb",
        period: str = "30d",
    ) -> str:
        """Compare feedback metrics between two customer segments. Use when PM asks about segment differences, which segment is happiest or unhappiest, or enterprise vs SMB comparisons."""
        days = int(period.replace("d", ""))
        out = f"Segment Comparison (Last {days} days):\n\n"

        for seg, label in [(segment_a, "Segment A"), (segment_b, "Segment B")]:
            cursor = conn.execute(
                """SELECT COUNT(*) as c, AVG(sentiment_score) as avg_sent
                   FROM feedback f
                   WHERE f.org_id = ? AND f.customer_segment = ?
                   AND (f.ingested_at >= datetime('now', ?) OR f.created_at >= datetime('now', ?))""",
                (org_id, seg, f"-{days} days", f"-{days} days"),
            )
            row = cursor.fetchone()
            count = row["c"] or 0
            avg_sent = row["avg_sent"] or 0.0
            out += f"{label} ({seg}): {count} items, avg sentiment {avg_sent:.2f}\n"
        return out

    @tool
    def revenue_impact(feature_area: str) -> str:
        """Calculate total ARR at risk for a specific product area or issue. Use when PM asks about revenue impact, business cost, or how much money is tied to an issue."""
        cursor = conn.execute(
            """SELECT DISTINCT customer_id FROM feedback
               WHERE org_id = ? AND feature_area = ? AND customer_id IS NOT NULL""",
            (org_id, feature_area),
        )
        cids = [r["customer_id"] for r in cursor.fetchall() if r["customer_id"]]
        if not cids:
            return f"No feedback with linked customers for area '{feature_area}'."

        placeholders = ",".join("?" * len(cids))
        cursor = conn.execute(
            f"""SELECT company_name, arr FROM customers WHERE org_id = ? AND id IN ({placeholders})
               ORDER BY arr DESC LIMIT 10""",
            [org_id] + cids,
        )
        rows = cursor.fetchall()
        total = sum(r["arr"] or 0 for r in rows)
        cursor = conn.execute(
            f"SELECT SUM(arr) as total FROM customers WHERE org_id = ? AND id IN ({placeholders})",
            [org_id] + cids,
        )
        total = cursor.fetchone()["total"] or 0

        out = f"Revenue Impact for '{feature_area}':\n\n"
        out += f"Total ARR at Risk: ${total:,.0f}\n"
        out += f"Affected customers: {len(cids)}\n\nTop customers:\n"
        for r in rows:
            out += f"- {r['company_name']}: ${(r['arr'] or 0):,.0f}\n"
        return out

    @tool
    def rice_scoring(period: str = "30d", limit: int = 5) -> str:
        """Calculate RICE priority scores for top issues. Reach = customers affected, Impact = ARR at risk + sentiment severity, Confidence = data quality, Effort = scope estimate. Use when PM asks about priorities or what to build next."""
        days = int(period.replace("d", ""))
        date_cutoff = f"-{days} days"
        cursor = conn.execute(
            """SELECT COALESCE(NULLIF(TRIM(feature_area), ''), 'unknown') as feature_area,
               COUNT(*) as count, COUNT(DISTINCT customer_id) as unique_customers,
               AVG(sentiment_score) as avg_sentiment, GROUP_CONCAT(DISTINCT customer_id) as customer_ids
               FROM feedback WHERE org_id = ? AND is_feedback = 1 AND sentiment = 'negative'
               AND COALESCE(ingested_at, created_at) >= datetime('now', ?)
               GROUP BY COALESCE(NULLIF(TRIM(feature_area), ''), 'unknown')
               ORDER BY count DESC LIMIT ?""",
            (org_id, date_cutoff, limit),
        )
        rows = [dict(r) for r in cursor.fetchall()]
        if not rows:
            return f"No negative feedback for RICE scoring in the last {days} days."

        scored = []
        for r in rows:
            raw_area = r["feature_area"] or "unknown"
            area = "Uncategorized" if raw_area.lower() == "unknown" else raw_area
            reach = r["unique_customers"] or 0
            cids = (r["customer_ids"] or "").split(",")
            cids = [c.strip() for c in cids if c.strip()]
            total_arr = 0
            if cids:
                ph = ",".join("?" * len(cids))
                cr = conn.execute(
                    f"SELECT SUM(arr) as total FROM customers WHERE org_id = ? AND id IN ({ph})",
                    [org_id] + cids,
                ).fetchone()
                total_arr = cr["total"] or 0
            impact_val = abs(r["avg_sentiment"] or 0) * 100 + min(total_arr / 10000, 100)
            confidence = min(r["count"] * 10, 100)
            effort = 50
            rice = (reach * impact_val * confidence) / effort if effort else 0
            scored.append((area, reach, total_arr, r["avg_sentiment"] or 0, confidence, rice))

        out = f"RICE Priority Scores (Last {days} days):\n\n"
        sorted_scored = sorted(scored, key=lambda x: -x[5])
        for i, (area, reach, arr, sent, conf, rice) in enumerate(sorted_scored, 1):
            out += f"{i}. {area}\n"
            out += f"   Reach: {reach} customers | Impact: ${arr:,.0f} ARR, sentiment {sent:.2f}\n"
            out += f"   Confidence: {conf}% | Effort: 50 (estimate)\n"
            out += f"   RICE Score: {rice:.0f}\n\n"
        # Append parseable lines for #1 issue so spec chain can populate metadata
        if sorted_scored and rows:
            top_area = sorted_scored[0][0]
            fa_for_db = "unknown" if top_area == "Uncategorized" else top_area
            fid_cursor = conn.execute(
                """SELECT id FROM feedback WHERE org_id = ? AND is_feedback = 1 AND sentiment = 'negative'
                   AND COALESCE(NULLIF(TRIM(feature_area), ''), 'unknown') = ?
                   AND COALESCE(ingested_at, created_at) >= datetime('now', ?)
                   ORDER BY COALESCE(ingested_at, created_at) DESC LIMIT 15""",
                (org_id, fa_for_db, date_cutoff),
            )
            fids = [row["id"] for row in fid_cursor.fetchall()]
            cid_cursor = conn.execute(
                """SELECT DISTINCT customer_id FROM feedback WHERE org_id = ? AND is_feedback = 1
                   AND COALESCE(NULLIF(TRIM(feature_area), ''), 'unknown') = ?
                   AND COALESCE(ingested_at, created_at) >= datetime('now', ?) AND customer_id IS NOT NULL
                   LIMIT 20""",
                (org_id, fa_for_db, date_cutoff),
            )
            cids = [row["customer_id"] for row in cid_cursor.fetchall() if row["customer_id"]]
            arr_val = sorted_scored[0][2]
            rice_val = sorted_scored[0][5]
            out += "For spec generation use these exact lines:\n"
            if fids:
                out += f"Feedback IDs: {', '.join(fids)}\n"
            if cids:
                out += f"Customer IDs: {', '.join(cids)}\n"
            out += f"ARR impacted: ${arr_val:,.0f}\n"
            out += f"RICE score: {rice_val:.0f}\n"
        return out

    return [
        search_feedback,
        trend_analysis,
        top_issues,
        find_similar_feedback,
        compare_segments,
        revenue_impact,
        rice_scoring,
    ]
