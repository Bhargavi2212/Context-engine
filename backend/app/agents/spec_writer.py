"""Spec Writer Agent: runs full multi-agent spec chain and returns chat summary."""
from app.agents.spec_chain import spec_chain
from app.agents.spec_chain_state import SpecChainState
from app.agents.state import AgentState
from app.services import spec_service


def extract_topic(message: str) -> str:
    """Extract the spec topic from the PM's message. Strip common prefixes."""
    if not message or not isinstance(message, str):
        return message or ""
    lower = message.strip().lower()
    prefixes = [
        "generate specs for",
        "create specs for",
        "write specs for",
        "specs for",
        "generate spec for",
    ]
    for prefix in prefixes:
        if lower.startswith(prefix):
            return message[len(prefix) :].strip()
    return message.strip()


def summarize_doc(doc: str, max_chars: int = 200) -> str:
    """First paragraph or first max_chars of document."""
    if not doc or not doc.strip():
        return ""
    doc = doc.strip()
    first_para = doc.split("\n\n")[0] if "\n\n" in doc else doc
    first_para = first_para.strip()
    if len(first_para) <= max_chars:
        return first_para
    return first_para[: max_chars - 3].rstrip() + "..."


async def spec_generation_node(state: AgentState) -> AgentState:
    """Run the full multi-agent spec generation chain (async per spec)."""
    messages = state.get("messages", [])
    if not messages:
        state["agent_response"] = "I need a message to generate specs. Try: Generate specs for checkout issues."
        return state

    last = messages[-1]
    content = last.get("content", "") if isinstance(last, dict) else getattr(last, "content", "")
    topic = extract_topic(content)

    conn = state.get("conn")
    org_id = state.get("org_id", "")
    product_context = state.get("product_context") or {}

    spec_state: SpecChainState = {
        "topic": topic,
        "messages": list(messages),
        "org_id": org_id,
        "product_context": product_context,
        "conn": conn,
        "analyst_brief": "",
        "customer_brief": "",
        "prd": "",
        "architecture": "",
        "rules": "",
        "plan": "",
        "feedback_ids": [],
        "customer_ids": [],
        "arr_impacted": 0.0,
        "rice_score": 0.0,
    }

    result = await spec_chain.ainvoke(spec_state)
    spec_id = spec_service.save_spec(conn, org_id, result)

    prd = result.get("prd") or ""
    architecture = result.get("architecture") or ""
    rules = result.get("rules") or ""
    plan = result.get("plan") or ""
    feedback_ids = result.get("feedback_ids") or []
    arr_impacted = float(result.get("arr_impacted") or 0)

    state["agent_response"] = (
        f"I've generated engineering specs for **{topic}**!\n\n"
        f"**PRD:** {summarize_doc(prd)}\n\n"
        f"**Architecture:** {summarize_doc(architecture)}\n\n"
        f"**Engineering Rules:** {summarize_doc(rules)}\n\n"
        f"**Implementation Plan:** {summarize_doc(plan)}\n\n"
        f"[View Full Specs](/specs/{spec_id})\n\n"
        f"The specs cite {len(feedback_ids)} feedback items **from real customers**. "
        f"Total ARR impacted: ${arr_impacted:,.0f}."
    )
    return state
