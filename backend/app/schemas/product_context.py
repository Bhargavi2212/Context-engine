"""Pydantic schemas for product context API and bulk save.

Validation rules (from spec):
- product_name: max 200 chars
- description: max 2000 chars
- Strip whitespace; reject empty strings for required fields
- URLs: start with http:// or https://
- Numbers (revenue_share, price, size): >= 0
- Dates: ISO (YYYY-MM-DD)
"""
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


def _strip_whitespace(v: str | None) -> str | None:
    if v is None:
        return None
    s = v.strip()
    return s if s else None


# --- Section data models (for bulk payload items) ---


class ProductBasicsData(BaseModel):
    """Product basics (step 1)."""

    product_name: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    industry: Literal["SaaS", "Fintech", "Healthcare", "E-commerce", "Education", "Media", "Other"] | None = None
    stage: Literal["Pre-launch", "Early", "Growth", "Mature", "Enterprise"] | None = None
    website_url: str | None = None

    @field_validator("product_name", "description", "website_url")
    @classmethod
    def strip_fields(cls, v: str | None) -> str | None:
        return _strip_whitespace(v)

    @field_validator("website_url")
    @classmethod
    def validate_url(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        s = v.strip()
        if s and not (s.startswith("http://") or s.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return s


class ProductAreaData(BaseModel):
    """Single product area."""

    name: str = Field(..., min_length=1)
    description: str | None = Field(None, max_length=2000)
    order: int | None = Field(None, ge=0)

    @field_validator("name", "description")
    @classmethod
    def strip_fields(cls, v: str | None) -> str | None:
        return _strip_whitespace(v)


class BusinessGoalData(BaseModel):
    """Single business goal."""

    title: str = Field(..., min_length=1)
    description: str | None = Field(None, max_length=2000)
    priority: Literal["P0", "P1", "P2", "P3"] | None = None
    time_period: Literal["Q1 2026", "Q2 2026", "H1 2026", "H2 2026", "2026"] | None = None
    linked_area: str | None = None

    @field_validator("title", "description", "linked_area")
    @classmethod
    def strip_fields(cls, v: str | None) -> str | None:
        return _strip_whitespace(v)


class CustomerSegmentData(BaseModel):
    """Single customer segment."""

    name: str = Field(..., min_length=1)
    description: str | None = Field(None, max_length=2000)
    revenue_share: float | None = Field(None, ge=0)

    @field_validator("name", "description")
    @classmethod
    def strip_fields(cls, v: str | None) -> str | None:
        return _strip_whitespace(v)


class PricingTierData(BaseModel):
    """Single pricing tier."""

    name: str = Field(..., min_length=1)
    price: float | None = Field(None, ge=0)
    period: Literal["monthly", "yearly"] | None = None
    target_segment: str | None = None

    @field_validator("name", "target_segment")
    @classmethod
    def strip_fields(cls, v: str | None) -> str | None:
        return _strip_whitespace(v)


class CompetitorData(BaseModel):
    """Single competitor (no website per spec)."""

    name: str = Field(..., min_length=1)
    strengths: str | None = Field(None, max_length=2000)
    weaknesses: str | None = Field(None, max_length=2000)
    differentiation: str | None = Field(None, max_length=2000)

    @field_validator("name", "strengths", "weaknesses", "differentiation")
    @classmethod
    def strip_fields(cls, v: str | None) -> str | None:
        return _strip_whitespace(v)


class RoadmapExistingData(BaseModel):
    """Single existing feature."""

    name: str = Field(..., min_length=1)
    status: Literal["Live", "Beta", "Alpha", "Deprecated"] | None = None
    linked_area: str | None = None

    @field_validator("name", "linked_area")
    @classmethod
    def strip_fields(cls, v: str | None) -> str | None:
        return _strip_whitespace(v)


class RoadmapPlannedData(BaseModel):
    """Single planned feature."""

    name: str = Field(..., min_length=1)
    status: Literal["Planned", "In Progress", "Blocked"] | None = None
    priority: Literal["P0", "P1", "P2", "P3"] | None = None
    target_date: str | None = None  # ISO YYYY-MM-DD
    linked_area: str | None = None

    @field_validator("name", "target_date", "linked_area")
    @classmethod
    def strip_fields(cls, v: str | None) -> str | None:
        return _strip_whitespace(v)


class TeamData(BaseModel):
    """Single team."""

    name: str = Field(..., min_length=1)
    lead: str | None = None
    owns_areas: list[str] = Field(default_factory=list)
    size: int | None = Field(None, ge=0)
    slack_channel: str | None = None

    @field_validator("name", "lead", "slack_channel")
    @classmethod
    def strip_fields(cls, v: str | None) -> str | None:
        return _strip_whitespace(v)


class TechStackData(BaseModel):
    """Single tech stack entry."""

    category: Literal[
        "Frontend", "Backend", "Database", "Infrastructure",
        "Analytics", "Auth", "Payments", "Other"
    ] = Field(...)
    technology: str = Field(..., min_length=1)
    notes: str | None = Field(None, max_length=2000)

    @field_validator("technology", "notes")
    @classmethod
    def strip_fields(cls, v: str | None) -> str | None:
        return _strip_whitespace(v)


# --- Bulk payload ---


class BulkItemPayload(BaseModel):
    """Single item in bulk section items array."""

    data: dict[str, Any]


class BulkSectionPayload(BaseModel):
    """One section in bulk save request."""

    section: str
    data: dict[str, Any] | None = None
    items: list[BulkItemPayload] | None = None


class BulkSaveRequest(BaseModel):
    """Bulk save request body."""

    sections: list[BulkSectionPayload] = Field(default_factory=list)


# --- Response models ---


class ProductContextItemResponse(BaseModel):
    """Single product context item (for list sections)."""

    id: str
    section: str
    data: dict[str, Any]
    created_at: str | None = None
    updated_at: str | None = None


class OnboardingStatusData(BaseModel):
    """Onboarding status response data."""

    has_product_context: bool
    has_feedback: bool
    has_customers: bool
    onboarding_complete: bool


class CreateItemRequest(BaseModel):
    """Create single item request body."""

    section: str
    data: dict[str, Any] = Field(default_factory=dict)


class UpdateItemRequest(BaseModel):
    """Update single item request body."""

    data: dict[str, Any] = Field(default_factory=dict)


# Valid section names for GET /{section}
WIZARD_SECTIONS = frozenset({
    "product_basics",
    "product_area",
    "business_goal",
    "customer_segment",
    "pricing_tier",
    "competitor",
    "roadmap_existing",
    "roadmap_planned",
    "team",
    "tech_stack",
})
