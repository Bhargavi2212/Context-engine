"""Load demo data: Acme Analytics org, demo user, product wizard, 15 customers, 40 feedback items.
Run from backend dir: python -m scripts.load_demo_data
Or from repo root: python backend/scripts/load_demo_data.py (with PYTHONPATH=backend)
Uses DATABASE_PATH from env or default.
"""
import os
import sqlite3
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.database import init_db
from app.utils.security import hash_password
from app.services.product_context_service import bulk_save
from scripts.seed_wizard_data import WIZARD_SECTIONS

DEMO_ORG_NAME = "Acme Analytics"
DEMO_EMAIL = "demo@contextengine.ai"
DEMO_PASSWORD = "demo123"
DEMO_USER_NAME = "Demo User"

CUSTOMERS = [
    ("BigRetail", "enterprise", 120000, "Enterprise Pro"),
    ("TechStart Inc", "smb", 2400, "Growth"),
    ("GlobalCorp", "enterprise", 300000, "Enterprise Plus"),
    ("SmallBiz Co", "smb", 600, "Starter"),
    ("TrialUser LLC", "trial", 0, "Free Trial"),
    ("DataDriven", "enterprise", 60000, "Enterprise Pro"),
    ("CloudNine", "smb", 7200, "Growth"),
    ("MegaStore", "enterprise", 150000, "Enterprise Plus"),
    ("StartupAlpha", "trial", 0, "Free Trial"),
    ("FinanceHub", "enterprise", 90000, "Enterprise Pro"),
    ("LocalShop", "smb", 199, "Starter"),
    ("EnterpriseX", "enterprise", 500000, "Enterprise Plus"),
    ("SMB Solutions", "smb", 3600, "Growth"),
    ("TrialCo", "trial", 0, "Free Trial"),
    ("RetailGiant", "enterprise", 200000, "Enterprise Plus"),
]

FEEDBACK_SAMPLES = [
    ("Checkout is too slow and I lost a customer.", "complaint", "negative", -0.7, "Checkout", "Payments Team", "high"),
    ("Dashboard takes 10 seconds to load.", "complaint", "negative", -0.8, "Dashboard", "Platform Team", "high"),
    ("Love the new analytics funnel!", "praise", "positive", 0.9, "Analytics", "Platform Team", "low"),
    ("Payment failed with no error message.", "bug_report", "negative", -0.9, "Checkout", "Payments Team", "critical"),
    ("Search returns irrelevant results.", "complaint", "negative", -0.5, "Search", "Platform Team", "medium"),
    ("Billing page is confusing for upgrades.", "feature_request", "negative", -0.4, "Billing", "Payments Team", "medium"),
    ("SSO setup was smooth.", "praise", "positive", 0.7, "Auth", "Identity Team", "low"),
    ("Mobile app crashes on iOS when opening reports.", "bug_report", "negative", -0.85, "Mobile", "Mobile Team", "critical"),
    ("API rate limits are too low for our use case.", "feature_request", "negative", -0.3, "API", "Integrations Team", "medium"),
    ("Onboarding wizard is great.", "praise", "positive", 0.8, "Onboarding", "Growth Team", "low"),
    ("Checkout abandoned at payment step – no saved cards.", "complaint", "negative", -0.6, "Checkout", "Payments Team", "high"),
    ("Dashboard widgets don't refresh automatically.", "feature_request", "neutral", 0.1, "Dashboard", "Platform Team", "low"),
    ("We need multi-currency support.", "feature_request", "neutral", 0.0, "Billing", "Payments Team", "medium"),
    ("Slack integration stopped working after update.", "bug_report", "negative", -0.7, "Integrations", "Integrations Team", "high"),
    ("Real-time collaboration is a game changer.", "praise", "positive", 0.9, "Collaboration", "Growth Team", "low"),
    ("Pricing page doesn't show enterprise plans.", "bug_report", "negative", -0.5, "Pricing", "Payments Team", "medium"),
    ("Auth timeout is too short for our workflows.", "feature_request", "negative", -0.4, "Auth", "Identity Team", "medium"),
    ("Data export is slow for large date ranges.", "complaint", "negative", -0.5, "Analytics", "Platform Team", "medium"),
    ("Mobile app needs dark mode.", "feature_request", "neutral", 0.2, "Mobile", "Mobile Team", "low"),
    ("Checkout error: card declined but no retry option.", "bug_report", "negative", -0.8, "Checkout", "Payments Team", "critical"),
    ("Dashboard filters are powerful.", "praise", "positive", 0.7, "Dashboard", "Platform Team", "low"),
    ("Webhook documentation is outdated.", "complaint", "negative", -0.4, "API", "Integrations Team", "low"),
    ("NPS survey integration would help.", "feature_request", "positive", 0.5, "Integrations", "Integrations Team", "low"),
    ("Renewal reminder emails are helpful.", "praise", "positive", 0.6, "Billing", "Payments Team", "low"),
    ("2FA setup was confusing.", "complaint", "negative", -0.5, "Auth", "Identity Team", "medium"),
    ("Search filters don't persist.", "bug_report", "negative", -0.4, "Search", "Platform Team", "medium"),
    ("Love the new checkout flow!", "praise", "positive", 0.85, "Checkout", "Payments Team", "low"),
    ("Dashboard export to PDF is broken.", "bug_report", "negative", -0.6, "Dashboard", "Platform Team", "high"),
    ("Need more granular RBAC.", "feature_request", "neutral", 0.0, "Auth", "Identity Team", "medium"),
    ("Trial expiration warning came too late.", "complaint", "negative", -0.4, "Onboarding", "Growth Team", "low"),
    ("API v2 would be great.", "feature_request", "positive", 0.4, "API", "Integrations Team", "low"),
    ("Checkout works great on mobile.", "praise", "positive", 0.75, "Checkout", "Payments Team", "low"),
    ("Billing portal is down.", "bug_report", "negative", -0.9, "Billing", "Payments Team", "critical"),
    ("Collaboration comments are useful.", "praise", "positive", 0.6, "Collaboration", "Growth Team", "low"),
    ("Pricing calculator would help.", "feature_request", "positive", 0.3, "Pricing", "Payments Team", "low"),
    ("Mobile app drains battery.", "complaint", "negative", -0.6, "Mobile", "Mobile Team", "high"),
    ("Slack bot is very responsive.", "praise", "positive", 0.7, "Integrations", "Integrations Team", "low"),
    ("Dashboard default view should be configurable.", "feature_request", "neutral", 0.1, "Dashboard", "Platform Team", "low"),
    ("Checkout discount codes don't stack.", "bug_report", "negative", -0.5, "Checkout", "Payments Team", "medium"),
    ("Onboarding checklist is clear.", "praise", "positive", 0.8, "Onboarding", "Growth Team", "low"),
]


def main() -> None:
    os.makedirs(os.path.dirname(settings.database_path) or ".", exist_ok=True)
    init_db()
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT id FROM organizations WHERE name = ?", (DEMO_ORG_NAME,)).fetchone()
        if not row:
            org_id = str(uuid.uuid4())
            conn.execute("INSERT INTO organizations (id, name) VALUES (?, ?)", (org_id, DEMO_ORG_NAME))
            conn.commit()
            print(f"Created org: {DEMO_ORG_NAME} ({org_id})")
        else:
            org_id = row["id"]
            print(f"Using existing org: {DEMO_ORG_NAME} ({org_id})")

        # Demo user
        existing_user = conn.execute("SELECT id FROM users WHERE email = ?", (DEMO_EMAIL,)).fetchone()
        if not existing_user:
            user_id = str(uuid.uuid4())
            password_hash = hash_password(DEMO_PASSWORD)
            conn.execute(
                "INSERT INTO users (id, org_id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, org_id, DEMO_EMAIL, password_hash, DEMO_USER_NAME, "pm"),
            )
            conn.commit()
            print(f"Created demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        else:
            print(f"Demo user already exists: {DEMO_EMAIL}")

        # Product wizard
        count = bulk_save(conn, org_id, WIZARD_SECTIONS)
        print(f"Saved {count} product context items")

        # Customers
        existing_customers = conn.execute("SELECT COUNT(*) AS c FROM customers WHERE org_id = ?", (org_id,)).fetchone()["c"]
        if existing_customers < 15:
            for company_name, segment, arr, plan in CUSTOMERS:
                cid = str(uuid.uuid4())
                conn.execute(
                    """INSERT INTO customers (id, org_id, company_name, segment, plan, arr, health_score)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (cid, org_id, company_name, segment, plan, arr, 50 + (arr // 10000) % 40),
                )
            conn.commit()
            print(f"Inserted {len(CUSTOMERS)} customers")
        else:
            print(f"Already have {existing_customers} customers")

        # Feedback (pre-classified; embedding left NULL so list/dashboard work; search may skip these until embedded)
        existing_feedback = conn.execute("SELECT COUNT(*) AS c FROM feedback WHERE org_id = ?", (org_id,)).fetchone()["c"]
        if existing_feedback < 40:
            customers_list = conn.execute("SELECT id, company_name FROM customers WHERE org_id = ? ORDER BY arr DESC LIMIT 15", (org_id,)).fetchall()
            cust_by_name = {r["company_name"]: r["id"] for r in customers_list}
            inserted = 0
            for text, ftype, sentiment, score, area, team, urgency in FEEDBACK_SAMPLES[:40]:
                fid = str(uuid.uuid4())
                customer_id = cust_by_name.get("BigRetail") if "BigRetail" in text or inserted % 5 == 0 else None
                customer_name = "BigRetail" if customer_id else None
                conn.execute(
                    """INSERT INTO feedback (id, org_id, text, source, is_feedback, feedback_type, sentiment, sentiment_score,
                       feature_area, team, urgency, confidence, customer_id, customer_name, ingestion_method)
                       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 0.9, ?, ?, 'load_demo_data')""",
                    (fid, org_id, text, "support_ticket", ftype, sentiment, score, area, team, urgency, customer_id, customer_name),
                )
                inserted += 1
            conn.commit()
            print(f"Inserted {inserted} feedback items")
        else:
            print(f"Already have {existing_feedback} feedback items")

        print("Demo data load complete. Login with", DEMO_EMAIL, "/", DEMO_PASSWORD)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
