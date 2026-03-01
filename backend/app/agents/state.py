"""Agent state for LangGraph."""
from typing import TypedDict, Any


class AgentState(TypedDict, total=False):
    """State passed through the agent graph."""

    messages: list
    intent: str
    agent_response: str
    org_id: str
    product_context: dict
    conn: Any
