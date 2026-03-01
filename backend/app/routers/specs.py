"""Specs API: list, get, update status, delete, regenerate."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import get_db
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser
from app.services import spec_service

router = APIRouter(prefix="/specs", tags=["specs"])


@router.get("")
def list_specs(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
) -> dict:
    """List all specs for the current org."""
    items, total = spec_service.list_specs(
        conn, current_user.org_id, page=page, page_size=page_size, status=status_filter
    )
    return {"data": items, "total": total}


@router.get("/{spec_id}")
def get_spec(
    spec_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated = Depends(get_db),
) -> dict:
    """Get full spec by id."""
    spec = spec_service.get_spec(conn, current_user.org_id, spec_id)
    if not spec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spec not found")
    return {"data": spec}


@router.put("/{spec_id}/status")
def update_spec_status(
    spec_id: str,
    body: dict,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated = Depends(get_db),
) -> dict:
    """Update spec status (draft | final | shared)."""
    new_status = body.get("status")
    if new_status not in ("draft", "final", "shared"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be one of: draft, final, shared",
        )
    updated = spec_service.update_spec_status(conn, current_user.org_id, spec_id, new_status)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spec not found")
    spec = spec_service.get_spec(conn, current_user.org_id, spec_id)
    return {"data": spec}


@router.delete("/{spec_id}")
def delete_spec(
    spec_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated = Depends(get_db),
) -> dict:
    """Delete a spec."""
    deleted = spec_service.delete_spec(conn, current_user.org_id, spec_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spec not found")
    return {"data": {"deleted": True}}


@router.post("/{spec_id}/regenerate")
def regenerate_spec(
    spec_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated = Depends(get_db),
) -> dict:
    """Re-run spec generation for the same topic and overwrite the spec."""
    from app.services import product_context_service

    product_context = product_context_service.get_all_for_org(conn, current_user.org_id)
    spec = spec_service.regenerate_spec(conn, current_user.org_id, spec_id, product_context)
    if not spec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spec not found")
    return {"data": spec}
