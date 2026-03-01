"""CSV/TSV parsing and column detection for feedback and customer uploads."""
import csv
import io
from pathlib import Path
from typing import Any

FEEDBACK_HEADER_MAP: dict[str, list[str]] = {
    "text": [
        "feedback", "message", "text", "description", "content", "body",
        "comment", "note", "review", "request", "review_text",
    ],
    "source": ["source", "source_type", "channel", "origin", "type"],
    "customer_name": ["company", "customer", "organization", "org", "account", "company_name"],
    "author_name": ["name", "author", "user", "reviewer", "submitter"],
    "rating": ["rating", "score", "stars", "nps"],
    "created_at": ["date", "created", "created_at", "timestamp", "time", "submitted"],
}

CUSTOMER_HEADER_MAP: dict[str, list[str]] = {
    "company_name": [
        "company", "company_name", "customer", "organization", "org",
        "account", "name",
    ],
    "segment": ["segment", "tier", "type", "plan_type", "customer_type"],
    "plan": ["plan", "plan_name", "subscription", "product"],
    "mrr": ["mrr", "monthly_revenue", "monthly"],
    "arr": ["arr", "annual_revenue", "annual", "revenue"],
    "account_manager": ["manager", "account_manager", "owner", "csm", "am"],
    "renewal_date": ["renewal", "renewal_date", "contract_end", "expiry"],
    "health_score": ["health", "health_score", "score", "nps"],
    "industry": ["industry", "vertical", "sector"],
    "employee_count": ["employees", "employee_count", "company_size", "size"],
}


def _match_header(our_field: str, headers: list[str], mapping: dict[str, list[str]]) -> str | None:
    """Match CSV header to our field using keyword mapping. Case-insensitive."""
    keywords = mapping.get(our_field, [])
    keywords_lower = {k.lower() for k in keywords}
    for h in headers:
        if not h:
            continue
        h_clean = h.strip().lower()
        if h_clean in keywords_lower:
            return h.strip()
        for kw in keywords_lower:
            if kw in h_clean:
                return h.strip()
        words = h_clean.replace("-", " ").replace("_", " ").split()
        if any(w in keywords_lower for w in words):
            return h.strip()
    return None


def detect_column_mapping(headers: list[str], for_feedback: bool = True) -> dict[str, str | None]:
    """Auto-detect column names (case-insensitive). Returns our_field -> csv_column."""
    mapping = FEEDBACK_HEADER_MAP if for_feedback else CUSTOMER_HEADER_MAP
    result: dict[str, str | None] = {}
    for our_field in mapping:
        matched = _match_header(our_field, headers, mapping)
        result[our_field] = matched
    first = next((h.strip() for h in headers if h and h.strip()), None)
    key = "text" if for_feedback else "company_name"
    if first and not result.get(key):
        result[key] = first
    return result


def _detect_delimiter(content: bytes, filename: str) -> str:
    """Detect CSV vs TSV delimiter."""
    if filename.lower().endswith(".tsv"):
        return "\t"
    sample = content[:8192].decode("utf-8-sig", errors="ignore")
    if "\t" in sample and sample.count("\t") > sample.count(","):
        return "\t"
    return ","


def parse_csv(content: bytes, filename: str) -> dict[str, Any]:
    """Parse CSV or TSV file. Returns columns, rows, preview_rows (first 5)."""
    delimiter = _detect_delimiter(content, filename)
    reader = csv.reader(io.StringIO(content.decode("utf-8-sig", errors="replace")), delimiter=delimiter)
    rows_list = list(reader)
    if not rows_list:
        return {"columns": [], "rows": [], "preview_rows": []}
    columns = [h.strip() if h else "" for h in rows_list[0]]
    rows = rows_list[1:]
    preview_rows = rows[:5]
    return {"columns": columns, "rows": rows, "preview_rows": preview_rows}


def rows_to_dicts(
    columns: list[str],
    rows: list[list[str]],
    column_mapping: dict[str, str],
) -> list[dict[str, Any]]:
    """Convert raw rows to list of dicts with our field names."""
    csv_to_our = {v: k for k, v in column_mapping.items() if v}
    result: list[dict[str, Any]] = []
    for row in rows:
        out: dict[str, Any] = {}
        for i, cell in enumerate(row):
            if i >= len(columns):
                break
            col = columns[i].strip()
            if col and col in csv_to_our:
                val = (cell or "").strip()
                if val:
                    out[csv_to_our[col]] = val
        result.append(out)
    return result
