"""Feedback service: CRUD and bulk import with classification pipeline."""
import asyncio
import json
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np

from app.pipeline.classifier import classify_with_fallback
from app.pipeline.customer_linker import fuzzy_match_customer
from app.pipeline.embedder import embed_batch, embed_text, deserialize_embedding, serialize_embedding
from app.services import product_context_service
from app.services.csv_service import parse_csv, rows_to_dicts
from app.services.upload_service import (
    get_upload_temp_path,
    update_upload_progress,
    update_upload_result,
    cleanup_temp,
)


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def _to_int(v: Any) -> int | None:
    if v is None:
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def _load_customers(conn: Any, org_id: str) -> list[dict[str, Any]]:
    cursor = conn.execute(
        "SELECT id, company_name, segment FROM customers WHERE org_id = ?",
        (org_id,),
    )
    return [dict(row) for row in cursor.fetchall()]


async def process_single_message(
    conn: Any,
    org_id: str,
    text: str,
    source: str = "slack",
    author_name: str | None = None,
    created_at: str | None = None,
    ingestion_method: str = "mcp_slack",
) -> tuple[int, int]:
    """Process one message through the classification pipeline. Returns (inserted_count, noise_count)."""
    product_context = product_context_service.get_all_for_org(conn, org_id)
    item = {
        "text": (text or "").strip(),
        "source": source,
        "author_name": author_name,
        "created_at": created_at or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    imported, failed, summary = await process_feedback_batch(
        [item], product_context, org_id, conn, upload_id=None, ingestion_method=ingestion_method
    )
    noise_count = summary.get("noise_count", 0)
    return imported, noise_count


async def process_feedback_batch(
    items: list[dict[str, Any]],
    product_context: dict[str, Any],
    org_id: str,
    conn: Any,
    upload_id: str | None = None,
    total: int = 0,
    ingestion_method: str = "csv_upload",
) -> tuple[int, int, dict[str, Any]]:
    """Classify (Semaphore 5) + embed (batch 10) + link + INSERT. Returns (imported, failed, summary)."""
    customers = _load_customers(conn, org_id)
    semaphore = asyncio.Semaphore(5)

    async def classify_one(item: dict) -> dict:
        async with semaphore:
            text = (item.get("text") or "").strip()
            if not text:
                return {**item, "is_feedback": False, "_skip": True}
            result = await classify_with_fallback(text, product_context)
            return {**item, **result}

    classified = await asyncio.gather(*[classify_one(it) for it in items])
    texts = [(it.get("text") or "")[:2000] for it in classified]
    embeddings = await embed_batch(texts, batch_size=10)

    imported = 0
    failed = 0
    sentiment_counts: dict[str, int] = {"positive": 0, "negative": 0, "neutral": 0}
    area_counts: dict[str, int] = {}
    customers_linked = 0
    customers_unlinked = 0

    for i, it in enumerate(classified):
        if it.get("_skip"):
            failed += 1
            if upload_id and total:
                update_upload_progress(conn, upload_id, imported + failed, total, "in_progress")
            continue

        text = (it.get("text") or "").strip()
        if not text:
            failed += 1
            continue

        customer_id = it.get("customer_id")
        customer_name = it.get("customer_name") or ""
        customer_segment = None
        if customer_id:
            match = next((c for c in customers if c["id"] == customer_id), None)
            if match:
                customer_name = match["company_name"]
                customer_segment = match.get("segment")
        elif cust_name := (it.get("customer_name") or it.get("author_name")):
            match = fuzzy_match_customer(cust_name, customers, threshold=0.6)
            if match:
                customer_id = match["id"]
                customer_name = match["company_name"]
                customer_segment = match.get("segment")

        if it.get("is_feedback") and customer_id:
            customers_linked += 1
        elif it.get("is_feedback"):
            customers_unlinked += 1

        sentiment = it.get("sentiment") or "neutral"
        sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
        area = it.get("feature_area") or "unknown"
        area_counts[area] = area_counts.get(area, 0) + 1

        embedding = embeddings[i] if i < len(embeddings) else None
        emb_blob = serialize_embedding(embedding) if embedding else None

        feedback_id = str(uuid.uuid4())
        created_at = it.get("created_at") or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        ingested_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        conn.execute(
            """INSERT INTO feedback (
                id, org_id, text, source, author_name, is_feedback, feedback_type,
                sentiment, sentiment_score, product, feature_area, team, urgency, confidence,
                rating, customer_id, customer_name, customer_segment, tags, embedding,
                created_at, ingested_at, ingestion_method
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                feedback_id,
                org_id,
                text,
                it.get("source"),
                it.get("author_name"),
                1 if it.get("is_feedback") else 0,
                it.get("feedback_type"),
                it.get("sentiment"),
                _to_float(it.get("sentiment_score")) or 0.0,
                it.get("product"),
                it.get("feature_area"),
                it.get("team"),
                it.get("urgency") or "medium",
                _to_float(it.get("confidence")) or 0.0,
                it.get("rating") and _to_int(it.get("rating")),
                customer_id,
                customer_name,
                customer_segment,
                None,
                emb_blob,
                created_at,
                ingested_at,
                ingestion_method,
            ),
        )
        imported += 1
        if upload_id and total:
            update_upload_progress(conn, upload_id, imported + failed, total, "in_progress")

    conn.commit()
    top_areas = sorted(area_counts.items(), key=lambda x: -x[1])[:10]
    summary = {
        "total": len(items),
        "feedback_count": sum(1 for it in classified if it.get("is_feedback") and not it.get("_skip")),
        "noise_count": sum(1 for it in classified if not it.get("is_feedback") and not it.get("_skip")),
        "sentiment_breakdown": sentiment_counts,
        "top_areas": [{"area": a, "count": c} for a, c in top_areas],
        "customers_linked": customers_linked,
        "customers_unlinked": customers_unlinked,
    }
    return imported, failed, summary


def import_feedback_csv(
    conn: Any,
    upload_id: str,
    column_mapping: dict[str, str],
    org_id: str,
    default_source: str = "support_ticket",
    use_today_for_date: bool = True,
) -> dict[str, Any]:
    """Load rows from temp file, map columns, run pipeline, return summary with processing_time_seconds."""
    path_str = get_upload_temp_path(conn, upload_id)
    if not path_str or not Path(path_str).exists():
        raise ValueError("CSV file no longer available")
    content = Path(path_str).read_bytes()
    parsed = parse_csv(content, "upload.csv")
    columns = parsed["columns"]
    rows = parsed["rows"]
    if not rows:
        return {"total": 0, "feedback_count": 0, "noise_count": 0, "processing_time_seconds": 0}

    mapping = {k: v for k, v in column_mapping.items() if v}
    if "text" not in mapping:
        raise ValueError("Text column mapping is required")
    items = rows_to_dicts(columns, rows, mapping)

    for it in items:
        if not it.get("source") and default_source:
            it["source"] = default_source
        if not it.get("created_at") and use_today_for_date:
            it["created_at"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    product_context = product_context_service.get_all_for_org(conn, org_id)
    start = time.monotonic()
    imported, failed, summary = asyncio.run(
        process_feedback_batch(items, product_context, org_id, conn, upload_id, len(items), "csv_upload")
    )
    elapsed = time.monotonic() - start
    summary["processing_time_seconds"] = round(elapsed, 2)
    summary["total"] = len(items)
    summary["feedback_count"] = imported
    summary["noise_count"] = failed

    update_upload_result(conn, upload_id, imported, failed, summary, "completed")
    cleanup_temp(conn, upload_id)
    return summary


def create_feedback(conn: Any, data: dict[str, Any], org_id: str) -> dict[str, Any]:
    """Create single feedback item; classify + embed + link + INSERT."""
    product_context = product_context_service.get_all_for_org(conn, org_id)
    text = (data.get("text") or "").strip()
    if not text:
        raise ValueError("Feedback text is required")
    if len(text) < 2:
        raise ValueError("Feedback text is too short to classify; please add a few more words.")
    item = {
        "text": text,
        "source": data.get("source"),
        "author_name": data.get("author_name"),
        "customer_name": data.get("customer_name"),
        "customer_id": data.get("customer_id"),
        "rating": data.get("rating"),
        "created_at": data.get("created_at"),
    }
    imported, _, _ = asyncio.run(process_feedback_batch([item], product_context, org_id, conn, ingestion_method="manual_entry"))
    if imported == 0:
        raise ValueError("Failed to create feedback")
    cursor = conn.execute(
        "SELECT * FROM feedback WHERE org_id = ? ORDER BY ingested_at DESC LIMIT 1",
        (org_id,),
    )
    row = cursor.fetchone()
    return dict(row) if row else {}


def list_feedback(
    conn: Any,
    org_id: str,
    search: str | None = None,
    product_area: str | None = None,
    sentiment: str | None = None,
    source: str | None = None,
    customer_segment: str | None = None,
    customer_id: str | None = None,
    is_feedback: bool | None = None,
    urgency: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict[str, Any]], int]:
    """List feedback with filters and pagination. Returns (items, total)."""
    conditions = ["org_id = ?"]
    params: list[Any] = [org_id]
    if search:
        conditions.append("text LIKE ?")
        params.append(f"%{search}%")
    if product_area:
        conditions.append("feature_area = ?")
        params.append(product_area)
    if sentiment:
        conditions.append("sentiment = ?")
        params.append(sentiment)
    if source:
        conditions.append("source = ?")
        params.append(source)
    if customer_segment:
        conditions.append("customer_segment = ?")
        params.append(customer_segment)
    if customer_id:
        conditions.append("customer_id = ?")
        params.append(customer_id)
    if is_feedback is not None:
        conditions.append("is_feedback = ?")
        params.append(1 if is_feedback else 0)
    if urgency:
        conditions.append("urgency = ?")
        params.append(urgency)
    if date_from:
        conditions.append("ingested_at >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("ingested_at <= ?")
        params.append(date_to)

    where = " AND ".join(conditions)
    cursor = conn.execute(f"SELECT COUNT(*) AS c FROM feedback WHERE {where}", params)
    total = cursor.fetchone()["c"]
    offset = (page - 1) * per_page
    cursor = conn.execute(
        f"SELECT * FROM feedback WHERE {where} ORDER BY ingested_at DESC LIMIT ? OFFSET ?",
        params + [per_page, offset],
    )
    return [dict(row) for row in cursor.fetchall()], total


def get_feedback(conn: Any, org_id: str, feedback_id: str) -> dict[str, Any] | None:
    """Get single feedback item."""
    cursor = conn.execute(
        "SELECT * FROM feedback WHERE id = ? AND org_id = ?",
        (feedback_id, org_id),
    )
    row = cursor.fetchone()
    return dict(row) if row else None


def delete_feedback(conn: Any, org_id: str, feedback_id: str) -> bool:
    """Delete a feedback item. Returns True if deleted."""
    cursor = conn.execute(
        "DELETE FROM feedback WHERE id = ? AND org_id = ?",
        (feedback_id, org_id),
    )
    conn.commit()
    return cursor.rowcount > 0


def _normalize_feedback_text(text: str | None) -> str:
    """Normalize text for duplicate detection: strip and collapse whitespace."""
    if not text:
        return ""
    return " ".join((text or "").strip().split())


def merge_duplicate_feedback(conn: Any, org_id: str) -> dict[str, Any]:
    """For each (org_id, normalized text) with multiple rows, keep one (oldest by ingested_at), update specs to point to it, delete the rest. Returns { merged_count, deleted_count }."""
    cursor = conn.execute(
        """SELECT id, text, ingested_at FROM feedback WHERE org_id = ?
           ORDER BY COALESCE(ingested_at, created_at) ASC, id ASC""",
        (org_id,),
    )
    rows = [dict(r) for r in cursor.fetchall()]
    by_text: dict[str, list[str]] = {}
    for r in rows:
        key = _normalize_feedback_text(r.get("text"))
        if not key:
            continue
        if key not in by_text:
            by_text[key] = []
        by_text[key].append(r["id"])
    id_to_keep: dict[str, str] = {}
    to_delete: list[str] = []
    for _text_key, id_list in by_text.items():
        if len(id_list) <= 1:
            continue
        keep_id = id_list[0]
        for fid in id_list[1:]:
            id_to_keep[fid] = keep_id
            to_delete.append(fid)
    if not to_delete:
        conn.commit()
        return {"merged_count": 0, "deleted_count": 0}
    cursor = conn.execute(
        "SELECT id, feedback_ids FROM specs WHERE org_id = ?",
        (org_id,),
    )
    for row in cursor.fetchall():
        spec_id = row["id"]
        fid_raw = row["feedback_ids"]
        try:
            fids = json.loads(fid_raw) if fid_raw else []
        except (json.JSONDecodeError, TypeError):
            fids = []
        new_fids = [id_to_keep.get(fid, fid) for fid in fids]
        new_fids = list(dict.fromkeys(new_fids))
        conn.execute(
            "UPDATE specs SET feedback_ids = ? WHERE id = ? AND org_id = ?",
            (json.dumps(new_fids), spec_id, org_id),
        )
    for fid in to_delete:
        conn.execute("DELETE FROM feedback WHERE id = ? AND org_id = ?", (fid, org_id))
    conn.commit()
    merged_count = sum(1 for v in by_text.values() if len(v) > 1)
    return {"merged_count": merged_count, "deleted_count": len(to_delete)}


async def semantic_search(
    conn: Any,
    org_id: str,
    query: str,
    product_area: str | None = None,
    sentiment: str | None = None,
    source: str | None = None,
    customer_segment: str | None = None,
    urgency: str | None = None,
    feedback_type: str | None = None,
    is_feedback: bool | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Search feedback using semantic similarity. Ranks by similarity, then applies filters."""
    if not query or not query.strip():
        return []

    query_embedding = await embed_text(query.strip())
    query_vec = np.array(query_embedding, dtype=np.float32)

    cursor = conn.execute(
        """SELECT id, text, source, sentiment, sentiment_score, feature_area, team, urgency,
           confidence, customer_name, customer_segment, feedback_type, is_feedback,
           created_at, ingested_at, embedding FROM feedback WHERE org_id = ? AND embedding IS NOT NULL""",
        (org_id,),
    )
    rows = [dict(r) for r in cursor.fetchall()]

    results: list[dict[str, Any]] = []
    for row in rows:
        blob = row.pop("embedding", None)
        if not blob:
            continue
        stored_vec = deserialize_embedding(blob)
        norm_q = np.linalg.norm(query_vec)
        norm_s = np.linalg.norm(stored_vec)
        if norm_q == 0 or norm_s == 0:
            continue
        similarity = float(np.dot(query_vec, stored_vec) / (norm_q * norm_s))
        row["similarity_score"] = round(similarity, 4)
        results.append(row)

    results.sort(key=lambda x: x["similarity_score"], reverse=True)

    if product_area:
        results = [r for r in results if r.get("feature_area") == product_area]
    if sentiment:
        results = [r for r in results if r.get("sentiment") == sentiment]
    if source:
        results = [r for r in results if r.get("source") == source]
    if customer_segment:
        results = [r for r in results if r.get("customer_segment") == customer_segment]
    if urgency:
        results = [r for r in results if r.get("urgency") == urgency]
    if feedback_type:
        results = [r for r in results if r.get("feedback_type") == feedback_type]
    if is_feedback is not None:
        flag = 1 if is_feedback else 0
        results = [r for r in results if r.get("is_feedback") == flag]
    if date_from:
        results = [r for r in results if r.get("ingested_at", "") >= date_from]
    if date_to:
        results = [r for r in results if r.get("ingested_at", "") <= date_to]

    return results[:limit]


def find_similar(
    conn: Any,
    org_id: str,
    feedback_id: str,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Find feedback items similar to a given item using cosine similarity on embeddings."""
    cursor = conn.execute(
        "SELECT embedding FROM feedback WHERE id = ? AND org_id = ?",
        (feedback_id, org_id),
    )
    source_row = cursor.fetchone()
    if not source_row or not source_row["embedding"]:
        return []

    source_vec = deserialize_embedding(source_row["embedding"])
    norm_src = np.linalg.norm(source_vec)
    if norm_src == 0:
        return []

    cursor = conn.execute(
        """SELECT id, text, sentiment, feature_area, customer_name, created_at, ingested_at, embedding
           FROM feedback WHERE org_id = ? AND id != ? AND embedding IS NOT NULL""",
        (org_id, feedback_id),
    )
    rows = [dict(r) for r in cursor.fetchall()]

    results: list[dict[str, Any]] = []
    for row in rows:
        blob = row.pop("embedding", None)
        if not blob:
            continue
        stored_vec = deserialize_embedding(blob)
        norm_stored = np.linalg.norm(stored_vec)
        if norm_stored == 0:
            continue
        similarity = float(np.dot(source_vec, stored_vec) / (norm_src * norm_stored))
        row["similarity_score"] = round(similarity, 4)
        results.append(row)

    results.sort(key=lambda x: x["similarity_score"], reverse=True)
    return results[:limit]


def get_feedback_stats(conn: Any, org_id: str) -> dict[str, Any]:
    """Aggregate stats for filter UI: total, feedback_count, noise_count, by_* counts."""
    cursor = conn.execute(
        "SELECT COUNT(*) AS c, SUM(CASE WHEN is_feedback = 1 THEN 1 ELSE 0 END) AS fb, SUM(CASE WHEN is_feedback = 0 THEN 1 ELSE 0 END) AS noise FROM feedback WHERE org_id = ?",
        (org_id,),
    )
    row = cursor.fetchone()
    total = row["c"] or 0
    feedback_count = row["fb"] or 0
    noise_count = row["noise"] or 0

    def _agg(col: str, alias: str) -> dict[str, int]:
        cursor = conn.execute(
            f"SELECT {col} AS k, COUNT(*) AS v FROM feedback WHERE org_id = ? AND {col} IS NOT NULL AND {col} != '' GROUP BY {col}",
            (org_id,),
        )
        return {r["k"]: r["v"] for r in cursor.fetchall()}

    return {
        "total": total,
        "feedback_count": feedback_count,
        "noise_count": noise_count,
        "by_sentiment": _agg("sentiment", "sentiment"),
        "by_feature_area": _agg("feature_area", "feature_area"),
        "by_source": _agg("source", "source"),
        "by_urgency": _agg("urgency", "urgency"),
        "by_segment": _agg("customer_segment", "customer_segment"),
        "by_feedback_type": _agg("feedback_type", "feedback_type"),
    }
