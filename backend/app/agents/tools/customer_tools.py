"""Customer agent tools: 5 tools for customer lookup and risk analysis."""
from datetime import datetime, timedelta
from typing import Any

from langchain_core.tools import tool

from app.pipeline.customer_linker import fuzzy_match_customer
from app.services import customer_service


def get_customer_tools(conn: Any, org_id: str) -> list:
    """Return list of Customer tools bound to conn and org_id."""

    def _load_customers() -> list[dict]:
        cursor = conn.execute(
            "SELECT id, company_name, segment, arr, health_score, renewal_date, account_manager FROM customers WHERE org_id = ?",
            (org_id,),
        )
        return [dict(row) for row in cursor.fetchall()]

    def _find_customer(company_name: str) -> dict | None:
        customers = _load_customers()
        match = fuzzy_match_customer(company_name, customers, threshold=0.5)
        if not match:
            return None
        return customer_service.get_customer(conn, org_id, match["id"])

    @tool
    def customer_lookup(company_name: str) -> str:
        """Look up a customer profile by company name. Returns ARR, health score, segment, renewal date, account manager, and feedback summary. Use when PM asks about a specific customer."""
        c = _find_customer(company_name)
        if not c:
            return f"Customer '{company_name}' not found."
        arr = c.get("arr") or 0
        renewal = c.get("renewal_date", "—")
        if renewal and renewal != "—":
            try:
                r = datetime.fromisoformat(renewal.replace("Z", "+00:00"))
                days = (r.replace(tzinfo=None) - datetime.utcnow()).days
                renewal = f"{renewal[:10]} (in {days} days)" if days > 0 else f"{renewal[:10]} (past)"
            except Exception:
                pass
        out = f"Customer: {c.get('company_name', '?')}\n"
        out += f"Segment: {c.get('segment', '—')}\n"
        out += f"ARR: ${arr:,.0f}\n"
        out += f"Health Score: {c.get('health_score', '—')}\n"
        out += f"Renewal: {renewal}\n"
        out += f"Account Manager: {c.get('account_manager', '—')}\n"
        out += f"Feedback Count: {c.get('feedback_count', 0)}\n"
        out += f"Avg Sentiment: {c.get('avg_sentiment', 0):.2f}\n"
        return out

    @tool
    def at_risk_customers(days: int = 90, limit: int = 10) -> str:
        """Find customers at risk of churn. At risk = health_score below 50, or 3+ negative feedback items in last 30 days, or renewal within specified days with complaints. Sorted by ARR descending. Use when PM asks about churn risk, at-risk accounts, or customer health."""
        today = datetime.utcnow().strftime("%Y-%m-%d")
        end_date = (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d")
        cursor = conn.execute(
            """SELECT c.id, c.company_name, c.segment, c.arr, c.health_score, c.renewal_date,
               (SELECT COUNT(*) FROM feedback f WHERE f.customer_id = c.id AND f.org_id = c.org_id
                AND f.sentiment = 'negative' AND (f.ingested_at >= datetime('now', '-30 days')
                OR f.created_at >= datetime('now', '-30 days'))) AS neg_count
               FROM customers c WHERE c.org_id = ? AND (c.health_score < 50 OR c.renewal_date <= ?)
               ORDER BY c.arr DESC LIMIT ?""",
            (org_id, end_date, limit),
        )
        rows = [dict(r) for r in cursor.fetchall()]
        if not rows:
            return "No at-risk customers found."
        out = f"At-Risk Customers (top {limit} by ARR):\n\n"
        for r in rows:
            out += f"- {r['company_name']} (ID: {r['id']}): ARR ${(r['arr'] or 0):,.0f}, Health {r['health_score']}, Renewal {r['renewal_date'] or '—'}\n"
            if (r.get("neg_count") or 0) >= 3:
                out += f"  (3+ negative feedback in last 30 days)\n"
        out += "\nEnd your brief with: Customer IDs: <comma-separated IDs above>\n"
        return out

    @tool
    def customer_feedback_history(company_name: str, limit: int = 20) -> str:
        """Get all feedback from a specific customer, sorted by date. Use when PM asks what a customer has been saying or complaining about."""
        c = _find_customer(company_name)
        if not c:
            return f"Customer '{company_name}' not found."
        items, _ = customer_service.list_customer_feedback(conn, org_id, c["id"], page=1, per_page=limit)
        if not items:
            return f"No feedback from {c.get('company_name', company_name)}."
        out = f"Feedback from {c.get('company_name', '?')} (Customer ID: {c['id']}):\n\n"
        for i, f in enumerate(items, 1):
            txt = (f.get("text") or "")[:120]
            fid = f.get("id", "")
            out += f"{i}. [{f.get('sentiment', '—')}] {txt}...\n"
            out += f"   Feedback ID: {fid} · Area: {f.get('feature_area', '—')} · {f.get('ingested_at', f.get('created_at', ''))[:10]}\n\n"
        return out

    @tool
    def renewal_tracker(days: int = 90) -> str:
        """List upcoming renewals with health and feedback context. Use when PM asks about renewals, upcoming contracts, or accounts to watch."""
        today = datetime.utcnow().strftime("%Y-%m-%d")
        end_date = (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d")
        cursor = conn.execute(
            """SELECT c.id, c.company_name, c.segment, c.arr, c.health_score, c.renewal_date
               FROM customers c WHERE c.org_id = ? AND c.renewal_date >= ? AND c.renewal_date <= ?
               ORDER BY c.renewal_date ASC LIMIT 20""",
            (org_id, today, end_date),
        )
        rows = [dict(r) for r in cursor.fetchall()]
        if not rows:
            return f"No renewals in the next {days} days."
        out = f"Upcoming Renewals (next {days} days):\n\n"
        for r in rows:
            out += f"- {r['company_name']}: Renewal {r['renewal_date']}, ARR ${(r['arr'] or 0):,.0f}, Health {r['health_score']}\n"
        return out

    @tool
    def customer_comparison(company_a: str, company_b: str) -> str:
        """Compare two customers side by side — ARR, health, sentiment, feedback volume, top issues. Use when PM asks to compare accounts."""
        ca = _find_customer(company_a)
        cb = _find_customer(company_b)
        if not ca:
            return f"Customer '{company_a}' not found."
        if not cb:
            return f"Customer '{company_b}' not found."
        out = f"Comparison: {ca.get('company_name', company_a)} vs {cb.get('company_name', company_b)}\n\n"
        out += f"ARR:        ${(ca.get('arr') or 0):,.0f}  |  ${(cb.get('arr') or 0):,.0f}\n"
        out += f"Health:     {ca.get('health_score', '—')}  |  {cb.get('health_score', '—')}\n"
        out += f"Segment:    {ca.get('segment', '—')}  |  {cb.get('segment', '—')}\n"
        out += f"Feedback:   {ca.get('feedback_count', 0)}  |  {cb.get('feedback_count', 0)}\n"
        out += f"Avg Sent:   {ca.get('avg_sentiment', 0):.2f}  |  {cb.get('avg_sentiment', 0):.2f}\n"
        out += f"Renewal:    {ca.get('renewal_date', '—')}  |  {cb.get('renewal_date', '—')}\n"
        return out

    return [
        customer_lookup,
        at_risk_customers,
        customer_feedback_history,
        renewal_tracker,
        customer_comparison,
    ]
