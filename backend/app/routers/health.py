"""Health check: database and Mistral status."""
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends

from app.database import get_db
from app.database import _verify_mistral_sync as verify_mistral_sync

router = APIRouter(tags=["health"])


@router.get("/health")
def health(conn: Annotated[sqlite3.Connection, Depends(get_db)]) -> dict:
    """Return status, database info, Mistral status, version. Wrapped in { data }. Sync so DB conn used in same thread."""
    db_status = "error"
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
        row = cur.fetchone()
        if row is not None:
            db_status = "connected"
    except Exception:
        pass

    try:
        mistral_ok = verify_mistral_sync()
    except Exception:
        mistral_ok = False
    mistral_status = "connected" if mistral_ok else "disconnected"

    status_val = "healthy" if db_status == "connected" and mistral_ok else "degraded"
    payload = {
        "status": status_val,
        "database": db_status,
        "mistral": mistral_status,
        "version": "0.1.0",
    }
    return {"data": payload}
