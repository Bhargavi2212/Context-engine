"""Seed product wizard data for demo setup. Run from backend dir: python -m scripts.seed_wizard_data"""
import json
import os
import sqlite3
import sys

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.services.product_context_service import bulk_save


def get_first_org_id(conn: sqlite3.Connection) -> str | None:
    row = conn.execute("SELECT id FROM organizations LIMIT 1").fetchone()
    return row[0] if row else None


WIZARD_SECTIONS = [
    {
        "section": "product_basics",
        "data": {
            "product_name": "Acme Analytics",
            "description": "B2B SaaS data analytics and business intelligence platform for mid-market and enterprise companies. Helps teams track KPIs, build dashboards, and make data-driven decisions.",
            "industry": "SaaS",
            "stage": "Growth",
            "website_url": "https://acme-analytics.com",
        },
    },
    {
        "section": "product_area",
        "items": [
            {"data": {"name": "Checkout", "description": "Multi-step purchase flow including cart, shipping, payment, and order confirmation", "order": 0}},
            {"data": {"name": "Dashboard", "description": "Main analytics dashboard with charts, widgets, filters, and custom views", "order": 1}},
            {"data": {"name": "Analytics", "description": "Reporting engine including funnels, cohorts, trends, and data export", "order": 2}},
            {"data": {"name": "Search", "description": "Full-text and filtered search across all data, results pagination", "order": 3}},
            {"data": {"name": "Billing", "description": "Invoicing, payment methods, currency handling, subscription management", "order": 4}},
            {"data": {"name": "Auth", "description": "Authentication, SSO, 2FA, password reset, session management, RBAC", "order": 5}},
            {"data": {"name": "Mobile", "description": "iOS and Android app experience including push notifications", "order": 6}},
            {"data": {"name": "API", "description": "REST API, documentation, webhooks, rate limiting", "order": 7}},
            {"data": {"name": "Pricing", "description": "Pricing page, plan comparison, tier features, upgrade flows", "order": 8}},
            {"data": {"name": "Integrations", "description": "Third-party connectors including Slack, CRM sync, data import/export", "order": 9}},
            {"data": {"name": "Onboarding", "description": "Setup wizard, team invites, first-run experience", "order": 10}},
            {"data": {"name": "Collaboration", "description": "Real-time editing, sharing, comments, team workspaces", "order": 11}},
        ],
    },
    {
        "section": "business_goal",
        "items": [
            {"data": {"title": "Reduce checkout abandonment by 30%", "description": "Checkout drop-off is our #1 growth bottleneck. Currently 68% abandon at payment step.", "priority": "P0", "time_period": "Q1 2026", "linked_area": "Checkout"}},
            {"data": {"title": "Improve enterprise NPS from 32 to 50", "description": "Enterprise accounts are unhappy — 3 at-risk renewals this quarter worth $144K ARR.", "priority": "P0", "time_period": "Q1 2026", "linked_area": "Dashboard"}},
            {"data": {"title": "Fix mobile experience to 4+ star rating", "description": "Mobile app is rated 2.1 stars. Losing trial conversions.", "priority": "P1", "time_period": "Q1 2026", "linked_area": "Mobile"}},
            {"data": {"title": "Launch self-serve plan upgrade flow", "description": "40% of upgrade requests go through support. Automate to reduce support load.", "priority": "P1", "time_period": "Q2 2026", "linked_area": "Pricing"}},
            {"data": {"title": "Reduce dashboard load time to under 2 seconds", "description": "Dashboard performance degraded after v3.2 release. Enterprise customers complaining.", "priority": "P1", "time_period": "Q2 2026", "linked_area": "Dashboard"}},
            {"data": {"title": "Achieve SOC2 Type II compliance", "description": "Required by 4 enterprise prospects in pipeline worth $280K ARR.", "priority": "P2", "time_period": "H1 2026", "linked_area": "Auth"}},
        ],
    },
    {
        "section": "customer_segment",
        "items": [
            {"data": {"name": "Enterprise", "description": "Companies with 200+ employees, dedicated AM, custom contracts", "revenue_share": 65}},
            {"data": {"name": "SMB", "description": "Companies with 10-200 employees, self-serve or light-touch", "revenue_share": 25}},
            {"data": {"name": "Trial", "description": "Free trial users, 14-day limit, converting to paid", "revenue_share": 5}},
            {"data": {"name": "Consumer", "description": "Individual users on free or personal plans", "revenue_share": 5}},
        ],
    },
    {
        "section": "pricing_tier",
        "items": [
            {"data": {"name": "Free Trial", "price": 0, "period": "monthly", "target_segment": "Trial"}},
            {"data": {"name": "Starter", "price": 199, "period": "monthly", "target_segment": "SMB"}},
            {"data": {"name": "Growth", "price": 599, "period": "monthly", "target_segment": "SMB"}},
            {"data": {"name": "Enterprise Pro", "price": 2499, "period": "monthly", "target_segment": "Enterprise"}},
            {"data": {"name": "Enterprise Plus", "price": 4999, "period": "monthly", "target_segment": "Enterprise"}},
        ],
    },
    {
        "section": "competitor",
        "items": [
            {"data": {"name": "Mixpanel", "strengths": "Excellent funnel analytics, fast query engine, strong mobile SDK", "weaknesses": "Expensive at scale, no built-in BI, limited collaboration features", "differentiation": "We combine product analytics with full BI capabilities. One tool instead of two."}},
            {"data": {"name": "Amplitude", "strengths": "Great behavioral analytics, strong experimentation, large ecosystem", "weaknesses": "Complex UI, steep learning curve, expensive enterprise pricing", "differentiation": "We're easier to set up and use. Customers get value in hours, not weeks."}},
            {"data": {"name": "Looker (Google)", "strengths": "Powerful data modeling with LookML, deep SQL support, Google Cloud integration", "weaknesses": "Requires technical setup, not self-serve, expensive, slow for non-technical users", "differentiation": "We're self-serve from day one. PMs and analysts don't need engineering help."}},
            {"data": {"name": "Heap", "strengths": "Auto-capture everything, retroactive analytics, easy setup", "weaknesses": "Limited custom events, weaker for enterprise, basic dashboards", "differentiation": "We offer better enterprise features (SSO, RBAC, SLAs) with similar ease of use."}},
        ],
    },
    {
        "section": "roadmap_existing",
        "items": [
            {"data": {"name": "Basic Dashboard", "status": "Live", "linked_area": "Dashboard"}},
            {"data": {"name": "Funnel Analytics", "status": "Live", "linked_area": "Analytics"}},
            {"data": {"name": "CSV Data Import", "status": "Live", "linked_area": "Integrations"}},
            {"data": {"name": "Email/Password Auth", "status": "Live", "linked_area": "Auth"}},
            {"data": {"name": "REST API v1", "status": "Live", "linked_area": "API"}},
            {"data": {"name": "Stripe Billing Integration", "status": "Live", "linked_area": "Billing"}},
            {"data": {"name": "Basic Mobile App", "status": "Beta", "linked_area": "Mobile"}},
            {"data": {"name": "Slack Notifications", "status": "Live", "linked_area": "Integrations"}},
            {"data": {"name": "SSO (SAML)", "status": "Live", "linked_area": "Auth"}},
            {"data": {"name": "Real-time Collaboration", "status": "Beta", "linked_area": "Collaboration"}},
        ],
    },
    {
        "section": "roadmap_planned",
        "items": [
            {"data": {"name": "Checkout Flow Redesign", "status": "In Progress", "priority": "P0", "target_date": "Q1 2026", "linked_area": "Checkout"}},
            {"data": {"name": "Dashboard Performance Optimization", "status": "Planned", "priority": "P1", "target_date": "Q1 2026", "linked_area": "Dashboard"}},
            {"data": {"name": "Mobile App Rewrite (React Native)", "status": "Planned", "priority": "P1", "target_date": "Q2 2026", "linked_area": "Mobile"}},
            {"data": {"name": "Role-Based Access Control", "status": "In Progress", "priority": "P1", "target_date": "Q1 2026", "linked_area": "Auth"}},
            {"data": {"name": "Webhook Support", "status": "Planned", "priority": "P2", "target_date": "Q2 2026", "linked_area": "API"}},
            {"data": {"name": "Self-Serve Plan Upgrades", "status": "Planned", "priority": "P1", "target_date": "Q2 2026", "linked_area": "Pricing"}},
            {"data": {"name": "Advanced Search (Semantic)", "status": "Planned", "priority": "P2", "target_date": "Q2 2026", "linked_area": "Search"}},
            {"data": {"name": "Multi-Currency Billing", "status": "Planned", "priority": "P2", "target_date": "Q2 2026", "linked_area": "Billing"}},
            {"data": {"name": "Two-Factor Authentication", "status": "In Progress", "priority": "P1", "target_date": "Q1 2026", "linked_area": "Auth"}},
            {"data": {"name": "API v2 with GraphQL", "status": "Planned", "priority": "P3", "target_date": "H2 2026", "linked_area": "API"}},
        ],
    },
    {
        "section": "team",
        "items": [
            {"data": {"name": "Payments Team", "lead": "Mike Rodriguez", "owns_areas": ["Checkout", "Billing", "Pricing"], "size": 6, "slack_channel": "#team-payments"}},
            {"data": {"name": "Platform Team", "lead": "Lisa Park", "owns_areas": ["Dashboard", "Analytics", "Search"], "size": 8, "slack_channel": "#team-platform"}},
            {"data": {"name": "Identity Team", "lead": "Kevin Zhao", "owns_areas": ["Auth", "Onboarding"], "size": 4, "slack_channel": "#team-identity"}},
            {"data": {"name": "Mobile Team", "lead": "Dev Patel", "owns_areas": ["Mobile"], "size": 3, "slack_channel": "#team-mobile"}},
            {"data": {"name": "Integrations Team", "lead": "Hans Mueller", "owns_areas": ["API", "Integrations"], "size": 5, "slack_channel": "#team-integrations"}},
            {"data": {"name": "Growth Team", "lead": "Amy Chen", "owns_areas": ["Collaboration", "Onboarding"], "size": 4, "slack_channel": "#team-growth"}},
        ],
    },
    {
        "section": "tech_stack",
        "items": [
            {"data": {"category": "Frontend", "technology": "React 18", "notes": "With TypeScript, Vite bundler, Tailwind CSS"}},
            {"data": {"category": "Frontend", "technology": "React Native", "notes": "Mobile app (currently Expo, migrating to bare RN)"}},
            {"data": {"category": "Backend", "technology": "Node.js 20", "notes": "Express.js API, TypeScript"}},
            {"data": {"category": "Backend", "technology": "Python 3.11", "notes": "ML/analytics microservices, FastAPI"}},
            {"data": {"category": "Database", "technology": "PostgreSQL 16", "notes": "Primary data store, hosted on AWS RDS"}},
            {"data": {"category": "Database", "technology": "Redis 7", "notes": "Caching, session store, rate limiting"}},
            {"data": {"category": "Database", "technology": "Elasticsearch 8", "notes": "Search, analytics aggregations, logging"}},
            {"data": {"category": "Infrastructure", "technology": "AWS", "notes": "ECS Fargate for containers, S3 for storage, CloudFront CDN"}},
            {"data": {"category": "Infrastructure", "technology": "Docker", "notes": "All services containerized, docker-compose for local dev"}},
            {"data": {"category": "Other", "technology": "Datadog", "notes": "APM, logs, dashboards, alerting"}},
            {"data": {"category": "Other", "technology": "GitHub Actions", "notes": "Build, test, deploy pipelines"}},
            {"data": {"category": "Auth", "technology": "Auth0", "notes": "SSO/SAML provider, migrating to in-house"}},
        ],
    },
]


def main() -> None:
    os.makedirs(os.path.dirname(settings.database_path) or ".", exist_ok=True)
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    try:
        org_id = get_first_org_id(conn)
        if not org_id:
            print("No organization found. Create one first (register/login).")
            sys.exit(1)
        count = bulk_save(conn, org_id, WIZARD_SECTIONS)
        print(f"Saved {count} product context items for org {org_id}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
