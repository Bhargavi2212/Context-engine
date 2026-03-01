"""Upload API: feedback and customer CSV upload, import, status, history."""
import csv
import json
import io
from pathlib import Path
from typing import Annotated

import sqlite3
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status

from app.database import get_db
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser
from app.schemas.feedback import ImportFeedbackRequest, ImportFeedbackResponse
from app.schemas.customer import ImportCustomerRequest, ImportCustomerResponse
from app.schemas.upload import UploadParseResponse, UploadStatusResponse
from app.services import csv_service, feedback_service, customer_service, upload_service

router = APIRouter(prefix="/upload", tags=["upload"])

MAX_CSV_SIZE = 50 * 1024 * 1024  # 50MB


def _build_preview(columns: list[str], rows: list[list[str]], suggested: dict[str, str | None]) -> list[dict]:
    """Build preview rows with our field names."""
    csv_to_our = {v: k for k, v in suggested.items() if v}
    out = []
    for row in rows[:5]:
        d: dict = {}
        for i, cell in enumerate(row):
            if i >= len(columns):
                break
            col = columns[i].strip()
            if col and col in csv_to_our:
                d[csv_to_our[col]] = (cell or "").strip()
        out.append(d)
    return out


def _run_feedback_import(
    upload_id: str,
    column_mapping: dict[str, str],
    org_id: str,
    default_source: str,
    use_today_for_date: bool,
) -> None:
    """Background task: run feedback import (sync, uses conn from new connection)."""
    from app.database import get_db
    gen = get_db()
    conn = next(gen)
    try:
        upload_service.update_upload_progress(conn, upload_id, 0, 0, "in_progress")
        feedback_service.import_feedback_csv(
            conn, upload_id, column_mapping, org_id, default_source, use_today_for_date
        )
    except Exception:
        upload_service.update_upload_result(conn, upload_id, 0, 0, {"error": "Import failed"}, "failed")
    finally:
        conn.close()


def _run_customer_import(upload_id: str, column_mapping: dict[str, str], org_id: str) -> None:
    """Background task: run customer import."""
    from app.database import get_db
    gen = get_db()
    conn = next(gen)
    try:
        upload_service.update_upload_progress(conn, upload_id, 0, 0, "in_progress")
        customer_service.import_customers_csv(conn, upload_id, column_mapping, org_id)
    except Exception:
        upload_service.update_upload_result(conn, upload_id, 0, 0, {"error": "Import failed"}, "failed")
    finally:
        conn.close()


@router.post("/feedback")
async def upload_feedback(
    file: Annotated[UploadFile, File()],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Upload feedback CSV/TSV; parse, save temp, return upload_id, columns, suggested_mapping, preview."""
    if not file.filename or not (file.filename.lower().endswith(".csv") or file.filename.lower().endswith(".tsv")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be CSV or TSV")
    content = await file.read()
    if len(content) > MAX_CSV_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 50MB)")
    temp_path = upload_service.save_uploaded_file(content, file.filename or "upload.csv")
    parsed = csv_service.parse_csv(content, file.filename or "upload.csv")
    columns = parsed["columns"]
    rows = parsed["rows"]
    suggested = csv_service.detect_column_mapping(columns, for_feedback=True)
    upload_id = upload_service.create_upload(
        conn, current_user.org_id, "feedback", file.filename or "upload.csv", len(rows), temp_path
    )
    preview = _build_preview(columns, rows, suggested)
    return {
        "data": {
            "upload_id": upload_id,
            "filename": file.filename or "upload.csv",
            "rows": len(rows),
            "columns": columns,
            "preview": preview,
            "suggested_mapping": {k: v for k, v in suggested.items() if v},
        }
    }


@router.post("/feedback/import")
def import_feedback(
    body: ImportFeedbackRequest,
    background_tasks: BackgroundTasks,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Start feedback import in background; return upload_id immediately."""
    upload = upload_service.get_upload(conn, current_user.org_id, body.upload_id)
    if not upload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    if not body.column_mapping.get("text"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text column mapping is required")
    background_tasks.add_task(
        _run_feedback_import,
        body.upload_id,
        body.column_mapping,
        current_user.org_id,
        body.default_source or "support_ticket",
        body.use_today_for_date if body.use_today_for_date is not None else True,
    )
    return {"data": {"upload_id": body.upload_id}}


@router.get("/history")
def list_uploads(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """List upload history for org. Route MUST be defined before /{upload_id}/status."""
    items = upload_service.list_uploads(conn, current_user.org_id)
    return {"data": items}


@router.get("/{upload_id}/status")
def get_upload_status(
    upload_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Get upload progress for polling."""
    upload = upload_service.get_upload(conn, current_user.org_id, upload_id)
    if not upload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    data: dict = {
        "processed": upload.get("processed", 0),
        "total": upload.get("total_rows", 0),
        "status": upload.get("status", "pending"),
    }
    if upload.get("status") in ("completed", "failed"):
        data["imported_rows"] = upload.get("imported_rows", 0)
        data["failed_rows"] = upload.get("failed_rows", 0)
        if upload.get("result_data"):
            try:
                data["result_data"] = json.loads(upload["result_data"]) if isinstance(upload.get("result_data"), str) else upload.get("result_data")
            except (json.JSONDecodeError, TypeError):
                pass
    return {"data": data}


@router.post("/customers")
async def upload_customers(
    file: Annotated[UploadFile, File()],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Upload customer CSV/TSV; parse, save temp, return upload_id, columns, suggested_mapping, preview."""
    if not file.filename or not (file.filename.lower().endswith(".csv") or file.filename.lower().endswith(".tsv")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be CSV or TSV")
    content = await file.read()
    if len(content) > MAX_CSV_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 50MB)")
    temp_path = upload_service.save_uploaded_file(content, file.filename or "upload.csv")
    parsed = csv_service.parse_csv(content, file.filename or "upload.csv")
    columns = parsed["columns"]
    rows = parsed["rows"]
    suggested = csv_service.detect_column_mapping(columns, for_feedback=False)
    upload_id = upload_service.create_upload(
        conn, current_user.org_id, "customer", file.filename or "upload.csv", len(rows), temp_path
    )
    preview = _build_preview(columns, rows, suggested)
    return {
        "data": {
            "upload_id": upload_id,
            "filename": file.filename or "upload.csv",
            "rows": len(rows),
            "columns": columns,
            "preview": preview,
            "suggested_mapping": {k: v for k, v in suggested.items() if v},
        }
    }


@router.post("/customers/import")
def import_customers(
    body: ImportCustomerRequest,
    background_tasks: BackgroundTasks,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict:
    """Start customer import in background; validate company_name required."""
    upload = upload_service.get_upload(conn, current_user.org_id, body.upload_id)
    if not upload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    if not body.column_mapping.get("company_name"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="company_name column mapping is required")
    background_tasks.add_task(_run_customer_import, body.upload_id, body.column_mapping, current_user.org_id)
    return {"data": {"upload_id": body.upload_id}}
