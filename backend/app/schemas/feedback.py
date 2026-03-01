"""Pydantic schemas for feedback API."""
from typing import Any

from pydantic import BaseModel, Field

FEEDBACK_SOURCES = [
    "app_store_review", "support_ticket", "nps_survey", "slack", "email",
    "sales_call", "internal", "interview", "bug_report", "g2_review",
    "community", "other",
]


class FeedbackCreate(BaseModel):
    """Manual feedback entry."""
    text: str = Field(..., min_length=1)
    source: str | None = None
    author_name: str | None = None
    customer_id: str | None = None
    rating: int | None = Field(None, ge=1, le=5)
    created_at: str | None = None


class FeedbackOut(BaseModel):
    """Single feedback item for API response."""
    id: str
    org_id: str
    text: str
    source: str | None
    author_name: str | None
    is_feedback: bool
    feedback_type: str | None
    sentiment: str | None
    sentiment_score: float | None
    product: str | None
    feature_area: str | None
    team: str | None
    urgency: str | None
    confidence: float | None
    rating: int | None
    customer_id: str | None
    customer_name: str | None
    customer_segment: str | None
    tags: str | None
    created_at: str | None
    ingested_at: str | None
    ingestion_method: str | None

    class Config:
        from_attributes = True


class FeedbackListOut(BaseModel):
    """Paginated feedback list response."""
    data: list[dict[str, Any]]
    total: int
    page: int
    per_page: int
    pages: int


class ImportFeedbackRequest(BaseModel):
    """Import feedback CSV request."""
    upload_id: str
    column_mapping: dict[str, str]
    default_source: str | None = "support_ticket"
    use_today_for_date: bool | None = True


class ImportFeedbackResponse(BaseModel):
    """Import feedback result."""
    total: int
    feedback_count: int
    noise_count: int
    sentiment_breakdown: dict[str, int]
    top_areas: list[dict[str, Any]]
    customers_linked: int
    customers_unlinked: int
    processing_time_seconds: float
