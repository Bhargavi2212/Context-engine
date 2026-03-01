"""Pydantic schemas for customer API."""
from typing import Any

from pydantic import BaseModel, Field

CUSTOMER_SEGMENTS = ["enterprise", "smb", "trial", "consumer"]


class CustomerCreate(BaseModel):
    """Manual customer entry."""
    company_name: str = Field(..., min_length=1)
    segment: str | None = None
    plan: str | None = None
    mrr: float | None = None
    arr: float | None = None
    account_manager: str | None = None
    renewal_date: str | None = None
    health_score: int | None = Field(None, ge=0, le=100)
    industry: str | None = None
    employee_count: int | None = None


class CustomerOut(BaseModel):
    """Single customer for API response."""
    id: str
    org_id: str
    company_name: str
    segment: str | None
    plan: str | None
    mrr: float | None
    arr: float | None
    account_manager: str | None
    renewal_date: str | None
    health_score: int | None
    industry: str | None
    employee_count: int | None
    created_at: str | None
    feedback_count: int | None = None

    class Config:
        from_attributes = True


class CustomerListOut(BaseModel):
    """Paginated customer list response."""
    data: list[dict[str, Any]]
    total: int
    page: int
    per_page: int
    pages: int


class ImportCustomerRequest(BaseModel):
    """Import customer CSV request."""
    upload_id: str
    column_mapping: dict[str, str]


class ImportCustomerResponse(BaseModel):
    """Import customer result."""
    count: int
    segments: dict[str, int]
    total_arr: float
