"""Product context API: CRUD and bulk save for wizard data."""
from typing import Annotated
from uuid import UUID

import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser
from app.schemas.product_context import (
    BulkSaveRequest,
    CreateItemRequest,
    UpdateItemRequest,
    WIZARD_SECTIONS,
)
from app.services import product_context_service

router = APIRouter(prefix="/product-context", tags=["product-context"])


@router.get("/")
def get_all(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Get all product context for current org."""
    data = product_context_service.get_all_for_org(conn, current_user.org_id)
    return {"data": data}


@router.post("/bulk")
def post_bulk(
    body: BulkSaveRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Save entire wizard (delete all + reinsert)."""
    sections = [s.model_dump() for s in body.sections]
    count = product_context_service.bulk_save(conn, current_user.org_id, sections)
    return {"data": {"count": count}}


@router.post("/")
def post_item(
    body: CreateItemRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Create a single product context item. Body: { section, data }."""
    section = body.section
    data = body.data
    if not section or section not in WIZARD_SECTIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invalid section: {section}",
        )
    if data is None or not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="data must be an object",
        )
    row = product_context_service.create_item(
        conn, current_user.org_id, section, data
    )
    return {"data": row}


@router.put("/{item_id}")
def put_item(
    item_id: UUID,
    body: UpdateItemRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Update a single product context item."""
    data = body.data
    row = product_context_service.update_item(
        conn, current_user.org_id, str(item_id), data
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    return {"data": row}


@router.delete("/{item_id}")
def delete_item(
    item_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Delete a single product context item."""
    deleted = product_context_service.delete_item(
        conn, current_user.org_id, str(item_id)
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    return {"data": {"deleted": True}}


@router.get("/{section}")
def get_section(
    section: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Get all items for a specific section."""
    if section not in WIZARD_SECTIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invalid section: {section}",
        )
    data = product_context_service.get_section(
        conn, current_user.org_id, section
    )
    if section == "product_basics":
        return {"data": data if data else {}}
    return {"data": data or []}
