"""Phase 6 spec generation chain: Analyst gather → Customer gather → Spec Writer (4 docs)."""
import re
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_mistralai import ChatMistralAI
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import create_react_agent

from app.agents.prompts import (
    build_analyst_prompt,
    build_customer_prompt,
    format_competitors,
    format_goals,
    format_roadmap,
    format_segments,
    format_tech_stack,
    format_teams,
)
from app.agents.spec_chain_state import SpecChainState
from app.agents.tools.analyst_tools import get_analyst_tools
from app.agents.tools.customer_tools import get_customer_tools


# Tool names for extracting last AI message (skip tool calls)
ANALYST_TOOL_NAMES = {
    "search_feedback", "trend_analysis", "top_issues", "find_similar_feedback",
    "compare_segments", "revenue_impact", "rice_scoring",
}
CUSTOMER_TOOL_NAMES = {
    "customer_lookup", "at_risk_customers", "customer_feedback_history",
    "renewal_tracker", "customer_comparison",
}


def _last_ai_message_content(messages: list, tool_names: set) -> str:
    """Extract last non-tool-call AI text message content."""
    for m in reversed(messages):
        if not hasattr(m, "content") or not isinstance(m.content, str):
            continue
        content = (m.content or "").strip()
        if not content:
            continue
        if getattr(m, "tool_calls", None):
            continue
        if content in tool_names or (len(content) < 25 and " " not in content and "_" in content):
            continue
        return m.content
    return ""


def _parse_metadata_from_briefs(analyst_brief: str, customer_brief: str) -> tuple[list, list, float, float]:
    """Parse feedback_ids, customer_ids, arr_impacted, rice_score from briefs. Returns (feedback_ids, customer_ids, arr_impacted, rice_score)."""
    feedback_ids: list = []
    customer_ids: list = []
    arr_impacted = 0.0
    rice_score = 0.0
    combined = (analyst_brief or "") + "\n" + (customer_brief or "")

    # Feedback IDs: id1, id2 or Feedback IDs: id1 id2
    for text in (analyst_brief or "", customer_brief or ""):
        m = re.search(r"Feedback\s+IDs?\s*:\s*([^\n]+)", text, re.I)
        if m:
            raw = re.sub(r"[,;\s]+", " ", m.group(1)).strip()
            feedback_ids = [x.strip() for x in raw.split() if x.strip() and x.strip() not in ("and", "—", "-")]
            break
    if not feedback_ids:
        m = re.search(r"feedback_ids?\s*[=:]\s*\[([^\]]*)\]", combined, re.I)
        if m:
            feedback_ids = [x.strip().strip('"\'') for x in m.group(1).split(",") if x.strip()]
    # Fallback: collect UUIDs mentioned after "ID:" or "Feedback ID:" in analyst brief (likely feedback IDs)
    if not feedback_ids and analyst_brief:
        for m in re.finditer(r"(?:Feedback\s+)?ID\s*:\s*([0-9a-fA-F-]{36})", analyst_brief):
            feedback_ids.append(m.group(1).strip())

    # Customer IDs
    for text in (customer_brief or "", analyst_brief or ""):
        m = re.search(r"Customer\s+IDs?\s*:\s*([^\n]+)", text, re.I)
        if m:
            raw = re.sub(r"[,;\s]+", " ", m.group(1)).strip()
            customer_ids = [x.strip() for x in raw.split() if x.strip() and x.strip() not in ("and", "—", "-")]
            break
    if not customer_ids and customer_brief:
        for m in re.finditer(r"\(ID\s*:\s*([0-9a-fA-F-]{36})\)", customer_brief):
            customer_ids.append(m.group(1).strip())

    # ARR impacted: $266000 or 266000
    for text in (analyst_brief or "", customer_brief or ""):
        m = re.search(r"ARR\s+impacted\s*:\s*\$?\s*([\d,]+(?:\.\d+)?)", text, re.I)
        if m:
            try:
                arr_impacted = float(m.group(1).replace(",", ""))
                break
            except ValueError:
                pass
    if arr_impacted == 0 and "ARR at Risk:" in combined:
        m = re.search(r"ARR\s+at\s+Risk\s*:\s*\$?\s*([\d,]+(?:\.\d+)?)", combined, re.I)
        if m:
            try:
                arr_impacted = float(m.group(1).replace(",", ""))
            except ValueError:
                pass

    # RICE score (top issue)
    for text in (analyst_brief or "",):
        m = re.search(r"RICE\s+score\s*:\s*([\d.]+)", text, re.I)
        if m:
            try:
                rice_score = float(m.group(1))
                break
            except ValueError:
                pass
    if rice_score == 0 and "RICE Score:" in combined:
        m = re.search(r"RICE\s+Score\s*:\s*([\d.]+)", combined, re.I)
        if m:
            try:
                rice_score = float(m.group(1))
            except ValueError:
                pass

    return (feedback_ids, customer_ids, arr_impacted, rice_score)


def analyst_gather(state: SpecChainState) -> SpecChainState:
    """Phase A: Analyst gathers patterns, top issues, RICE, trends, revenue impact."""
    conn = state.get("conn")
    org_id = state.get("org_id", "")
    product_context = state.get("product_context") or {}
    topic = state.get("topic", "")

    tools = get_analyst_tools(conn, org_id, product_context)
    system_prompt = build_analyst_prompt(product_context)
    llm = ChatMistralAI(model="mistral-medium-latest", temperature=0.3, timeout=120)

    gathering_prompt = f"""I need to generate engineering specs for: {topic}

Gather ALL relevant data by calling your tools. I need:
1. Search for all feedback related to this topic (use **search_feedback**)
2. Get the top issues and their RICE scores (use **top_issues** or **rice_scoring**)
3. Analyze the trend — is this getting better or worse? (use **trend_analysis**)
4. Calculate the total revenue impact (use **revenue_impact**)

For each piece of feedback you find, include:
- The exact text (for citations in the spec)
- The customer name and segment
- The sentiment score
- The date

Compile everything into a structured brief. Include specific numbers for everything.

End your response with these lines for parsing (if you have the data):
Feedback IDs: <comma-separated list of feedback ids you referenced>
ARR impacted: $<total ARR at risk>
RICE score: <top RICE score for this topic>"""

    graph = create_react_agent(model=llm, tools=tools, prompt=system_prompt)
    result = graph.invoke({"messages": [HumanMessage(content=gathering_prompt)]})
    out_msgs = result.get("messages", [])
    output = _last_ai_message_content(out_msgs, ANALYST_TOOL_NAMES)
    state["analyst_brief"] = output or "No analyst brief generated."
    return state


def customer_gather(state: SpecChainState) -> SpecChainState:
    """Phase B: Customer Agent gathers at-risk customers, feedback history, renewals."""
    conn = state.get("conn")
    org_id = state.get("org_id", "")
    product_context = state.get("product_context") or {}
    topic = state.get("topic", "")
    analyst_brief = (state.get("analyst_brief") or "")[:2000]

    tools = get_customer_tools(conn, org_id)
    system_prompt = build_customer_prompt(product_context)
    llm = ChatMistralAI(model="mistral-medium-latest", temperature=0.3, timeout=120)

    gathering_prompt = f"""I'm generating engineering specs for: {topic}

The Analyst found these patterns:
{analyst_brief}

Now I need customer impact data. Call your tools to find:
1. Which customers are most affected by this issue? (check at_risk_customers)
2. What are the specific complaints from the top affected customers? (get their feedback history)
3. Are any affected customers renewing soon? (check renewal_tracker)

For each affected customer, include:
- Company name
- ARR
- Health score
- Renewal date (and how many days away)
- Their specific feedback quotes about this issue
- Risk assessment (at risk / trending negative / stable)

Compile into a customer impact brief. Sort by ARR descending.

End your response with this line for parsing (if you have the data):
Customer IDs: <comma-separated list of customer ids you referenced>"""

    graph = create_react_agent(model=llm, tools=tools, prompt=system_prompt)
    result = graph.invoke({"messages": [HumanMessage(content=gathering_prompt)]})
    out_msgs = result.get("messages", [])
    output = _last_ai_message_content(out_msgs, CUSTOMER_TOOL_NAMES)
    state["customer_brief"] = output or "No customer brief generated."
    return state


def _populate_metadata(state: SpecChainState) -> SpecChainState:
    """Populate feedback_ids, customer_ids, arr_impacted, rice_score before save."""
    fid, cid, arr, rice = _parse_metadata_from_briefs(
        state.get("analyst_brief") or "",
        state.get("customer_brief") or "",
    )
    # Fallback: if still empty, get recent negative feedback and derived metadata from DB
    conn = state.get("conn")
    org_id = state.get("org_id", "")
    if conn and org_id and (not fid or not cid or arr == 0):
        cursor = conn.execute(
            """SELECT id, customer_id FROM feedback
               WHERE org_id = ? AND is_feedback = 1 AND sentiment = 'negative'
               ORDER BY COALESCE(ingested_at, created_at) DESC LIMIT 20""",
            (org_id,),
        )
        rows = cursor.fetchall()
        if rows and not fid:
            fid = [r["id"] for r in rows if r.get("id")]
        if rows and not cid:
            cid = list({r["customer_id"] for r in rows if r.get("customer_id")})
        if cid and arr == 0:
            ph = ",".join("?" * len(cid))
            cur = conn.execute(
                f"SELECT SUM(arr) as total FROM customers WHERE org_id = ? AND id IN ({ph})",
                [org_id] + cid,
            )
            row = cur.fetchone()
            if row and row["total"]:
                arr = float(row["total"])
        if rice == 0 and fid:
            rice = 50.0  # default so spec shows a value
    state["feedback_ids"] = fid
    state["customer_ids"] = cid
    state["arr_impacted"] = arr
    state["rice_score"] = rice
    return state


def _generate_prd(llm: ChatMistralAI, state: SpecChainState) -> str:
    """Generate PRD document."""
    pc = state.get("product_context") or {}
    basics = pc.get("product_basics") or {}
    prompt = f"""Generate a Product Requirements Document (PRD) for: {state['topic']}

## Data from Analyst Agent
{state.get('analyst_brief', '')}

## Data from Customer Agent
{state.get('customer_brief', '')}

## Product Context
Product: {basics.get('product_name', 'Unknown')}
Goals: {format_goals(pc)}
Segments: {format_segments(pc)}
Competitors: {format_competitors(pc)}

## PRD Structure — Follow This Exactly

### 1. Problem Statement
What's broken, who's affected, and the business impact. Use REAL numbers from the data above — feedback count, customer count, ARR at risk. Name specific customers.

### 2. User Stories
Derive from real feedback quotes. Format: "As a [segment] customer, I need [requirement] because [real feedback quote from data]." Include customer name and ARR.

### 3. Functional Requirements
Prioritized list:
- P0 (Must Have): Requirements that directly address the most cited complaints
- P1 (Should Have): Requirements that address secondary patterns
- P2 (Nice to Have): Improvements mentioned by fewer customers
Each requirement must trace to specific feedback. Include: "[Based on X feedback items from Y customers]"

### 4. Success Metrics
Measurable outcomes tied to the business goals from product context. Include current baseline from the data.

### 5. Out of Scope
What this spec intentionally does NOT address. Note related issues that should be separate specs.

### 6. Open Questions
Unresolved items that need team input before implementation.

## Citation Rules
- Quote specific customer feedback with attribution: "As [Customer Name] ($[ARR] ARR, [segment]) reported: '[quote]'"
- Include specific dollar figures for revenue impact
- Reference the owning team from product context
- Connect to business goals by name when relevant"""
    response = llm.invoke([
        SystemMessage(content="You are a senior product manager writing a PRD. Write in clear, professional prose. Every requirement must trace to real data. Be specific, not generic."),
        HumanMessage(content=prompt),
    ])
    return (response.content or "").strip()


def _generate_architecture(llm: ChatMistralAI, state: SpecChainState) -> str:
    """Generate Architecture Brief."""
    pc = state.get("product_context") or {}
    prd = (state.get("prd") or "")[:3000]
    tech_stack = format_tech_stack(pc)
    prompt = f"""Generate an Architecture Brief for: {state['topic']}

## PRD Summary (already generated)
{prd}

## Current Tech Stack
{tech_stack}

## Structure — Follow This Exactly

### 1. System Overview
How this feature fits into the existing architecture. Reference the tech stack above.

### 2. Technical Approach
Recommended implementation strategy. Be specific about frameworks, libraries, patterns.

### 3. Data Model Changes
New or modified database tables/schemas. Show actual SQL or schema definitions.

### 4. API Changes
New or modified endpoints. Include method, path, request/response shapes.

### 5. Dependencies
External services, libraries, or internal systems needed.

### 6. Migration Strategy
How to roll this out safely — database migrations, backward compatibility, feature flags.

### 7. Performance Considerations
Load, latency, caching, scaling implications.

### 8. Security Considerations
Auth, data access, input validation, PII handling."""
    response = llm.invoke([
        SystemMessage(content="You are a senior software architect. Write actionable technical specs. Include concrete implementation details, not hand-wavy suggestions."),
        HumanMessage(content=prompt),
    ])
    return (response.content or "").strip()


def _generate_rules(llm: ChatMistralAI, state: SpecChainState) -> str:
    """Generate Engineering Rules."""
    prd = (state.get("prd") or "")[:2000]
    analyst_brief = (state.get("analyst_brief") or "")[:2000]
    prompt = f"""Generate Engineering Rules for: {state['topic']}

## PRD Summary
{prd}

## Customer Feedback Patterns (edge cases come from real complaints)
{analyst_brief}

## Structure — Follow This Exactly

### 1. Constraints & Non-Negotiables
Hard rules that must be followed. Derived from the most critical customer complaints.

### 2. Edge Cases
Real edge cases derived from actual feedback patterns. For each:
- The scenario (from real feedback)
- Expected behavior
- Why it matters (cite the customer/feedback)

### 3. Accessibility Requirements
WCAG compliance, keyboard navigation, screen reader support relevant to this feature.

### 4. Testing Requirements
Unit tests, integration tests, E2E tests. Specific test cases derived from the feedback patterns.

### 5. Error Handling
How errors should be handled. Derived from complaints about confusing error states.

### 6. Rollback Strategy
How to safely revert if something goes wrong. Feature flags, gradual rollout."""
    response = llm.invoke([
        SystemMessage(content="You are a senior engineer writing engineering rules. Be specific and opinionated. Every rule should prevent a real problem that customers reported."),
        HumanMessage(content=prompt),
    ])
    return (response.content or "").strip()


def _generate_plan(llm: ChatMistralAI, state: SpecChainState) -> str:
    """Generate Implementation Plan."""
    pc = state.get("product_context") or {}
    prd = (state.get("prd") or "")[:2000]
    architecture = (state.get("architecture") or "")[:2000]
    customer_brief = (state.get("customer_brief") or "")[:1500]
    teams = format_teams(pc)
    roadmap = format_roadmap(pc)
    prompt = f"""Generate an Implementation Plan for: {state['topic']}

## PRD Summary
{prd}

## Architecture Summary
{architecture}

## Available Teams
{teams}

## Current Roadmap
{roadmap}

## Customer Urgency
{customer_brief}

## Structure — Follow This Exactly

### 1. Phases
Break implementation into 2-4 phases. Each phase has:
- Clear deliverable
- Estimated duration
- Dependencies on other phases

Phase 1 should address the most critical issues (highest RICE score, most ARR at risk).

### 2. Team Assignments
Assign to the owning team from product context. Include:
- Lead engineer (if team lead is known)
- Estimated team members needed
- Skills required

### 3. Timeline
Realistic timeline considering team size and scope. Factor in:
- Customer urgency (renewals approaching)
- Business goal deadlines from product context
- Dependencies

### 4. Dependencies
What must be completed before each phase can start. Cross-team dependencies.

### 5. Rollout Strategy
- Phase 1: Internal testing + alpha with the most vocal customer
- Phase 2: Beta with affected enterprise customers (name them)
- Phase 3: GA rollout
- Feature flags for each phase
- Monitoring and success criteria per phase

### 6. Risk & Mitigation
What could go wrong. How to mitigate. What's the rollback plan."""
    response = llm.invoke([
        SystemMessage(content="You are a senior engineering manager writing an implementation plan. Be realistic about timelines. Prioritize by customer impact."),
        HumanMessage(content=prompt),
    ])
    return (response.content or "").strip()


def spec_writer_generate(state: SpecChainState) -> SpecChainState:
    """Phase C: Populate metadata then generate 4 documents."""
    state = _populate_metadata(state)
    llm = ChatMistralAI(
        model="mistral-large-latest",
        temperature=0.4,
        max_tokens=8000,
        timeout=180,
    )
    state["prd"] = _generate_prd(llm, state)
    state["architecture"] = _generate_architecture(llm, state)
    state["rules"] = _generate_rules(llm, state)
    state["plan"] = _generate_plan(llm, state)
    return state


# Build and compile the spec chain
_workflow = StateGraph(SpecChainState)
_workflow.add_node("analyst_gather", analyst_gather)
_workflow.add_node("customer_gather", customer_gather)
_workflow.add_node("spec_writer_generate", spec_writer_generate)
_workflow.set_entry_point("analyst_gather")
_workflow.add_edge("analyst_gather", "customer_gather")
_workflow.add_edge("customer_gather", "spec_writer_generate")
_workflow.add_edge("spec_writer_generate", END)

spec_chain = _workflow.compile()
