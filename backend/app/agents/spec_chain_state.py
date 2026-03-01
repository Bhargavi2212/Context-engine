"""State for the Phase 6 spec generation chain (Analyst → Customer → Spec Writer)."""
from typing import TypedDict, Any


class SpecChainState(TypedDict, total=False):
    """State passed through the spec chain graph."""

    topic: str
    messages: list
    org_id: str
    product_context: dict
    conn: Any
    analyst_brief: str
    customer_brief: str
    prd: str
    architecture: str
    rules: str
    plan: str
    feedback_ids: list
    customer_ids: list
    arr_impacted: float
    rice_score: float
