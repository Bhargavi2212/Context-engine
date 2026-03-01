"""Upload history and temporary file management for CSV imports."""
import json
import uuid
from pathlib import Path
from typing import Any

TEMP_UPLOAD_DIR = Path(__file__).resolve().parent.parent / "upload_temp"


def _ensure_temp_dir() -> Path:
    """Ensure temp upload directory exists."""
    TEMP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return TEMP_UPLOAD_DIR


def save_uploaded_file(content: bytes, filename: str) -> str:
    """Save uploaded file to temp directory. Returns path to saved file."""
    _ensure_temp_dir()
    ext = Path(filename).suffix or ".csv"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    path = TEMP_UPLOAD_DIR / unique_name
    path.write_bytes(content)
    return str(path)


def create_upload(
    conn: Any,
    org_id: str,
    upload_type: str,
    filename: str,
    total_rows: int,
    temp_path: str,
) -> str:
    """Create upload history record. Returns upload_id."""
    _ensure_temp_dir()
    upload_id = str(uuid.uuid4())
    record_id = str(uuid.uuid4())
    conn.execute(
        """INSERT INTO upload_history
           (id, org_id, upload_id, upload_type, filename, total_rows, imported_rows, failed_rows, status, processed, temp_file_path, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'pending', 0, ?, datetime('now'))""",
        (record_id, org_id, upload_id, upload_type, filename, total_rows, temp_path),
    )
    conn.commit()
    return upload_id


def get_upload(conn: Any, org_id: str, upload_id: str) -> dict[str, Any] | None:
    """Get single upload record. Returns None if not found or wrong org."""
    cursor = conn.execute(
        "SELECT * FROM upload_history WHERE upload_id = ? AND org_id = ?",
        (upload_id, org_id),
    )
    row = cursor.fetchone()
    if not row:
        return None
    return dict(row)


def get_upload_temp_path(conn: Any, upload_id: str) -> str | None:
    """Return temp file path for upload, or None if not found."""
    cursor = conn.execute("SELECT temp_file_path FROM upload_history WHERE upload_id = ?", (upload_id,))
    row = cursor.fetchone()
    if not row or not row["temp_file_path"]:
        return None
    return row["temp_file_path"]


def update_upload_progress(conn: Any, upload_id: str, processed: int, total: int, status: str) -> None:
    """Update upload progress for polling."""
    conn.execute(
        "UPDATE upload_history SET processed = ?, status = ? WHERE upload_id = ?",
        (processed, status, upload_id),
    )
    conn.commit()


def update_upload_result(
    conn: Any,
    upload_id: str,
    imported_rows: int,
    failed_rows: int,
    result_data: dict[str, Any] | None,
    status: str = "completed",
) -> None:
    """Update upload record with final result."""
    result_json = json.dumps(result_data) if result_data else None
    conn.execute(
        """UPDATE upload_history SET imported_rows = ?, failed_rows = ?, result_data = ?, status = ?, processed = ? WHERE upload_id = ?""",
        (imported_rows, failed_rows, result_json, status, imported_rows + failed_rows, upload_id),
    )
    conn.commit()


def list_uploads(conn: Any, org_id: str) -> list[dict[str, Any]]:
    """List upload history for org, newest first."""
    cursor = conn.execute(
        """SELECT id, org_id, upload_id, upload_type, filename, total_rows, imported_rows, failed_rows, status, processed, created_at
           FROM upload_history WHERE org_id = ? ORDER BY created_at DESC LIMIT 100""",
        (org_id,),
    )
    return [dict(row) for row in cursor.fetchall()]


def cleanup_temp(conn: Any, upload_id: str) -> None:
    """Delete temp file for upload."""
    path_str = get_upload_temp_path(conn, upload_id)
    if path_str:
        try:
            Path(path_str).unlink(missing_ok=True)
        except OSError:
            pass
        conn.execute("UPDATE upload_history SET temp_file_path = NULL WHERE upload_id = ?", (upload_id,))
        conn.commit()
