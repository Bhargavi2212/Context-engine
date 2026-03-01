"""Customer linking: fuzzy match feedback authors to customer profiles."""
from difflib import SequenceMatcher
from typing import Any, Optional


def fuzzy_match_customer(
    name: str,
    customers: list[dict[str, Any]],
    threshold: float = 0.6,
) -> Optional[dict[str, Any]]:
    """Find the best matching customer for a feedback author/company.

    If CSV has company/customer column, pass that as name.
    If only author_name, pass that; we fuzzy match against company_name.
    """
    if not name or not name.strip():
        return None

    best_match: Optional[dict[str, Any]] = None
    best_score = 0.0
    name_lower = name.lower().strip()

    for customer in customers:
        company = (customer.get("company_name") or "").strip()
        if not company:
            continue
        score = SequenceMatcher(None, name_lower, company.lower()).ratio()
        if score > best_score and score >= threshold:
            best_score = score
            best_match = customer

    return best_match
