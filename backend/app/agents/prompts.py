"""System prompts for Analyst and Customer agents."""


def build_analyst_prompt(product_context: dict) -> str:
    """Build Analyst Agent system prompt from product wizard data."""
    basics = product_context.get("product_basics") or {}
    areas = product_context.get("product_area") or []
    goals = product_context.get("business_goal") or []
    segments = product_context.get("customer_segment") or []
    competitors = product_context.get("competitor") or []
    teams = product_context.get("team") or []

    def _areas() -> str:
        if not areas:
            return "(None configured)"
        return "\n".join(
            f"- {a.get('data', {}).get('name', '?')}: {a.get('data', {}).get('description', '')}"
            for a in areas
        )

    def _goals() -> str:
        if not goals:
            return "(None configured)"
        return "\n".join(
            f"- [{g.get('data', {}).get('priority', 'P2')}] {g.get('data', {}).get('title', '?')}: {g.get('data', {}).get('description', '')}"
            for g in goals
        )

    def _segments() -> str:
        if not segments:
            return "(None configured)"
        return "\n".join(
            f"- {s.get('data', {}).get('name', '?')}: {s.get('data', {}).get('description', '')} ({s.get('data', {}).get('revenue_share', '?')}% revenue)"
            for s in segments
        )

    def _competitors() -> str:
        if not competitors:
            return "(None configured)"
        return "\n".join(
            f"- {c.get('data', {}).get('name', '?')}: Strengths: {c.get('data', {}).get('strengths', '')}. Weaknesses: {c.get('data', {}).get('weaknesses', '')}"
            for c in competitors
        )

    def _teams() -> str:
        if not teams:
            return "(None configured)"
        return "\n".join(
            f"- {t.get('data', {}).get('name', '?')}: lead: {t.get('data', {}).get('lead', '?')}, owns: {t.get('data', {}).get('owns_areas', '?')}"
            for t in teams
        )

    return f"""You are the Analyst Agent for Context Engine — a feedback intelligence platform.

You analyze customer feedback data to find patterns, trends, and priorities. You have tools that query the feedback database. ALWAYS use your tools — never guess or make up numbers.

## Product Context
Product: {basics.get('product_name', 'Unknown')}
Description: {basics.get('description', '')}
Industry: {basics.get('industry', '')}
Stage: {basics.get('stage', '')}

## Product Areas
{_areas()}

## Business Goals
{_goals()}

## Customer Segments
{_segments()}

## Competitors
{_competitors()}

## Teams
{_teams()}

## Rules
- ALWAYS use your tools to get data. Never guess numbers.
- When the user says "this feedback", "this issue", or asks about feedback they're viewing and has already included the feedback text in their message (e.g. "I'm viewing this feedback... Feedback: \"...\""), use that text to answer: describe the issue, use search_feedback or similar tools to find related data and affected customers — do NOT ask them to provide the exact feedback again.
- Cite specific numbers: feedback count, sentiment scores, customer count, ARR
- Rank issues using RICE: Reach (customers affected), Impact (ARR + sentiment), Confidence (data points), Effort (scope estimate)
- When mentioning product areas, note which team owns them
- Connect issues to business goals when relevant
- Be specific: "15 feedback items from 5 enterprise customers worth $266K ARR" not "several customers mentioned issues"
- If data is insufficient, say so clearly
- When feature_area is "unknown" or "Uncategorized", present it as "Uncategorized" feedback — report the numbers (count, ARR, sentiment) and note that configuring product areas in the product wizard would improve categorization. Do NOT speculate about data bugs, integration issues, or labeling problems."""


def build_customer_prompt(product_context: dict) -> str:
    """Build Customer Agent system prompt from product wizard data."""
    basics = product_context.get("product_basics") or {}
    segments = product_context.get("customer_segment") or []

    def _segments() -> str:
        if not segments:
            return "(None configured)"
        return "\n".join(
            f"- {s.get('data', {}).get('name', '?')}: {s.get('data', {}).get('description', '')} ({s.get('data', {}).get('revenue_share', '?')}% revenue)"
            for s in segments
        )

    return f"""You are the Customer Agent for Context Engine — a feedback intelligence platform.

You specialize in customer intelligence. You know customer profiles (ARR, health scores, renewal dates, segments) and their feedback history. You help PMs understand which customers need attention.

## Product Context
Product: {basics.get('product_name', 'Unknown')}

## Customer Segments
{_segments()}

## Rules
- ALWAYS use your tools to get data. Never guess.
- When the user says "this customer", "this feedback", or "tell me more about this customer/feedback" and has already provided a company name or feedback context in their message (e.g. "I'm viewing this feedback from **Company Name**"), use that company name immediately — do NOT ask them to provide the company name again. The company name is the part in bold after "from **" (e.g. "from **Acme Corp**" means company name is Acme Corp). Look up the customer by that name and their feedback using the tools.
- Include ARR, segment, and health score when discussing a customer
- Flag "at risk" customers: health_score < 50 AND renewal within 90 days
- Flag "trending negative": 3+ negative feedback items in last 30 days
- Sort at-risk customers by ARR descending (highest value first)
- Use relative dates: "renews in 23 days" not "renews April 15"
- If customer not found, say so clearly"""


# --- Spec Writer formatters (Phase 6) ---


def format_goals(product_context: dict) -> str:
    """Format business goals for spec prompts."""
    goals = product_context.get("business_goal") or []
    if not goals:
        return "(None configured)"
    return "\n".join(
        f"- [{g.get('data', {}).get('priority', 'P2')}] {g.get('data', {}).get('title', '?')}: {g.get('data', {}).get('description', '')}"
        for g in goals
    )


def format_segments(product_context: dict) -> str:
    """Format customer segments for spec prompts."""
    segments = product_context.get("customer_segment") or []
    if not segments:
        return "(None configured)"
    return "\n".join(
        f"- {s.get('data', {}).get('name', '?')}: {s.get('data', {}).get('description', '')} ({s.get('data', {}).get('revenue_share', '?')}% revenue)"
        for s in segments
    )


def format_competitors(product_context: dict) -> str:
    """Format competitors for spec prompts."""
    competitors = product_context.get("competitor") or []
    if not competitors:
        return "(None configured)"
    return "\n".join(
        f"- {c.get('data', {}).get('name', '?')}: Strengths: {c.get('data', {}).get('strengths', '')}. Weaknesses: {c.get('data', {}).get('weaknesses', '')}"
        for c in competitors
    )


def format_teams(product_context: dict) -> str:
    """Format teams for spec prompts."""
    teams = product_context.get("team") or []
    if not teams:
        return "(None configured)"
    return "\n".join(
        f"- {t.get('data', {}).get('name', '?')}: lead: {t.get('data', {}).get('lead', '?')}, owns: {t.get('data', {}).get('owns_areas', '?')}"
        for t in teams
    )


def format_roadmap(product_context: dict) -> str:
    """Format roadmap for spec prompts."""
    existing = product_context.get("roadmap_existing") or []
    planned = product_context.get("roadmap_planned") or []
    out = []
    if existing:
        for r in existing:
            d = r.get("data") or {}
            out.append(f"- Existing: {d.get('name', '?')} — {d.get('description', '')}")
    if planned:
        for r in planned:
            d = r.get("data") or {}
            out.append(f"- Planned: {d.get('name', '?')} — {d.get('description', '')}")
    return "\n".join(out) if out else "(None configured)"


def format_tech_stack(product_context: dict) -> str:
    """Format tech stack for spec prompts."""
    items = product_context.get("tech_stack") or []
    if not items:
        return "(None configured)"
    return "\n".join(
        f"- {t.get('data', {}).get('name', '?')}: {t.get('data', {}).get('description', '')}"
        for t in items
    )
