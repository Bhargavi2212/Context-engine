"""Feedback API: list, get, create."""
import math
from typing import Annotated

import sqlite3
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import get_db
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser
from app.schemas.feedback import FeedbackCreate, FeedbackOut
from app.services import feedback_service

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.get("/search")
async def search(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    q: str = Query(..., min_length=1),
    product_area: str | None = Query(None),
    sentiment: str | None = Query(None),
    source: str | None = Query(None),
    customer_segment: str | None = Query(None),
    urgency: str | None = Query(None),
    feedback_type: str | None = Query(None),
    is_feedback: bool | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """Semantic search with filters."""
    items = await feedback_service.semantic_search(
        conn,
        current_user.org_id,
        query=q,
        product_area=product_area,
        sentiment=sentiment,
        source=source,
        customer_segment=customer_segment,
        urgency=urgency,
        feedback_type=feedback_type,
        is_feedback=is_feedback,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )
    return {"data": [_row_to_dict(r) for r in items], "total": len(items), "query": q}


@router.get("/stats")
def stats(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Aggregate stats for filter UI."""
    data = feedback_service.get_feedback_stats(conn, current_user.org_id)
    return {"data": data}


@router.post("/")
def create(
    body: FeedbackCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Create single feedback item (manual entry); auto-classify, embed, link."""
    try:
        row = feedback_service.create_feedback(
            conn,
            {
                "text": body.text,
                "source": body.source,
                "author_name": body.author_name,
                "customer_id": body.customer_id,
                "rating": body.rating,
                "created_at": body.created_at,
            },
            current_user.org_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"data": _row_to_dict(row)}


@router.get("/")
def list_feedback(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    search: str | None = Query(None),
    product_area: str | None = Query(None),
    sentiment: str | None = Query(None),
    source: str | None = Query(None),
    customer_segment: str | None = Query(None),
    customer_id: str | None = Query(None),
    is_feedback: bool | None = Query(None),
    urgency: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> dict:
    """List feedback with filters and pagination."""
    items, total = feedback_service.list_feedback(
        conn,
        current_user.org_id,
        search=search,
        product_area=product_area,
        sentiment=sentiment,
        source=source,
        customer_segment=customer_segment,
        customer_id=customer_id,
        is_feedback=is_feedback,
        urgency=urgency,
        date_from=date_from,
        date_to=date_to,
        page=page,
        per_page=per_page,
    )
    pages = math.ceil(total / per_page) if per_page else 0
    return {
        "data": [_row_to_dict(r) for r in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": pages,
    }


@router.post("/merge-duplicates")
def merge_duplicates(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Merge duplicate feedback: same org + same text → keep one, update specs, delete rest."""
    result = feedback_service.merge_duplicate_feedback(conn, current_user.org_id)
    return {"data": result}


@router.get("/{feedback_id}/similar")
def similar(
    feedback_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    limit: int = Query(5, ge=1, le=20),
) -> dict:
    """Find similar feedback items."""
    items = feedback_service.find_similar(conn, current_user.org_id, feedback_id, limit=limit)
    return {"data": [_row_to_dict(r) for r in items]}


@router.get("/{feedback_id}")
def get(
    feedback_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Get single feedback item."""
    row = feedback_service.get_feedback(conn, current_user.org_id, feedback_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
    return {"data": _row_to_dict(row)}


@router.delete("/{feedback_id}")
def delete(
    feedback_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Delete a feedback item."""
    deleted = feedback_service.delete_feedback(conn, current_user.org_id, feedback_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
    return {"data": {"deleted": True}}


def _row_to_dict(row: dict) -> dict:
    """Convert sqlite Row/dict to API-safe dict (exclude embedding blob)."""
    d = dict(row)
    if "embedding" in d:
        d.pop("embedding", None)
    return d
