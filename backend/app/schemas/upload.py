"""Pydantic schemas for upload API."""
from typing import Any

from pydantic import BaseModel


class UploadParseResponse(BaseModel):
    """Response from parse/upload feedback or customers CSV."""
    upload_id: str
    filename: str
    rows: int
    columns: list[str]
    preview: list[dict[str, Any]]
    suggested_mapping: dict[str, str | None]


class UploadStatusResponse(BaseModel):
    """Response from GET upload status (progress polling)."""
    processed: int
    total: int
    status: str
