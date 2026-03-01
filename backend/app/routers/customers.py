"""Customer API: list, get, create."""
import math
from typing import Annotated

import sqlite3
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import get_db
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser
from app.schemas.customer import CustomerCreate
from app.services import customer_service

router = APIRouter(prefix="/customers", tags=["customers"])


@router.post("/")
def create(
    body: CustomerCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Create single customer (manual entry)."""
    try:
        row = customer_service.create_customer(
            conn,
            body.model_dump(exclude_none=True),
            current_user.org_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"data": dict(row)}


@router.get("/{customer_id}/feedback")
def get_customer_feedback(
    customer_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> dict:
    """List feedback for a customer, paginated."""
    items, total = customer_service.list_customer_feedback(
        conn, current_user.org_id, customer_id, page=page, per_page=per_page
    )
    pages = math.ceil(total / per_page) if per_page else 0
    return {
        "data": items,
        "pagination": {"page": page, "page_size": per_page, "total": total},
    }


@router.get("/{customer_id}/stats")
def get_customer_stats(
    customer_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Customer stats for profile page."""
    data = customer_service.get_customer_stats(conn, current_user.org_id, customer_id)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return {"data": data}


@router.get("/{customer_id}/sentiment-trend")
def get_customer_sentiment_trend(
    customer_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Time-series sentiment data for chart."""
    periods = customer_service.get_customer_sentiment_trend(conn, current_user.org_id, customer_id)
    return {"periods": periods}


@router.get("/")
def list_customers(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    search: str | None = Query(None),
    segment: str | None = Query(None),
    health_min: int | None = Query(None),
    health_max: int | None = Query(None),
    renewal_before: str | None = Query(None),
    renewal_within_days: int | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort_by: str | None = Query(None),
    sort_order: str = Query("asc"),
) -> dict:
    """List customers with filters and pagination."""
    items, total = customer_service.list_customers(
        conn,
        current_user.org_id,
        search=search,
        segment=segment,
        health_min=health_min,
        health_max=health_max,
        renewal_before=renewal_before,
        renewal_within_days=renewal_within_days,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    pages = math.ceil(total / per_page) if per_page else 0
    return {
        "data": [dict(r) for r in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": pages,
    }


@router.get("/{customer_id}")
def get(
    customer_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Get single customer with feedback count."""
    row = customer_service.get_customer(conn, current_user.org_id, customer_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return {"data": dict(row)}


@router.delete("/{customer_id}")
def delete(
    customer_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Delete a customer. Feedback linked to them is unlinked (not deleted)."""
    deleted = customer_service.delete_customer(conn, current_user.org_id, customer_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return {"data": {"deleted": True}}


@router.post("/merge-duplicates")
def merge_duplicates(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Merge duplicate customers (same company_name): keep one per company, reassign feedback, delete extras."""
    result = customer_service.merge_duplicate_customers(conn, current_user.org_id)
    return {"data": result}
