"""Reclassify feedback with the current classifier prompt (e.g. after adding area descriptions).

Run from backend dir: python -m scripts.reclassify_feedback --org-id <ORG_ID> [options]

Options:
  --org-id          Required. Organization ID to reclassify.
  --uncategorized-only  Only reclassify rows where feature_area is null or empty.
  --batch-size N     Commit every N rows (default 20).
  --delay SEC        Seconds to sleep between API calls (default 0.5).
  --dry-run          Do not write to DB; only log what would be updated.
"""
import argparse
import asyncio
import os
import sys

import sqlite3

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.pipeline.classifier import classify_feedback
from app.services import product_context_service


def _to_float(v):
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Reclassify feedback with updated classifier prompt.")
    parser.add_argument("--org-id", required=True, help="Organization ID")
    parser.add_argument("--uncategorized-only", action="store_true", help="Only reclassify rows with no feature_area")
    parser.add_argument("--batch-size", type=int, default=20, help="Commit every N rows (default 20)")
    parser.add_argument("--delay", type=float, default=0.5, help="Seconds between API calls (default 0.5)")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to DB")
    args = parser.parse_args()

    db_path = settings.database_path
    if not os.path.isfile(db_path):
        print(f"Database not found: {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # Load product context
    product_context = product_context_service.get_all_for_org(conn, args.org_id)
    area_count = len(product_context.get("product_area") or [])
    if area_count == 0:
        print("No product areas configured for this org. Configure the product wizard first.")
        conn.close()
        sys.exit(1)

    # Fetch feedback to reclassify
    if args.uncategorized_only:
        cursor = conn.execute(
            "SELECT id, text FROM feedback WHERE org_id = ? AND (feature_area IS NULL OR TRIM(COALESCE(feature_area,'')) = '')",
            (args.org_id,),
        )
    else:
        cursor = conn.execute("SELECT id, text FROM feedback WHERE org_id = ?", (args.org_id,))
    rows = cursor.fetchall()
    total = len(rows)
    if total == 0:
        print("No feedback rows to reclassify.")
        conn.close()
        return

    print(f"Reclassifying {total} feedback row(s) (dry_run={args.dry_run}, batch_size={args.batch_size}, delay={args.delay}s)")

    updated = 0
    failed = 0

    async def run_one(row: sqlite3.Row) -> tuple[str | None, dict | None]:
        try:
            result = await classify_feedback(row["text"], product_context)
            return row["id"], result
        except Exception as e:
            print(f"  Classification failed for id={row['id']}: {e}")
            return row["id"], None

    async def process_all() -> None:
        nonlocal updated, failed
        batch: list[tuple[str, dict]] = []
        for i, row in enumerate(rows):
            fid, result = await run_one(row)
            if result is None:
                failed += 1
            else:
                batch.append((fid, result))
            if (i + 1) % 10 == 0:
                print(f"  Progress: {i + 1}/{total}")
            if args.delay > 0:
                await asyncio.sleep(args.delay)

        # Apply updates in batches
        for j in range(0, len(batch), args.batch_size):
            chunk = batch[j : j + args.batch_size]
            if args.dry_run:
                for fid, r in chunk:
                    print(f"  [dry-run] would set id={fid} feature_area={r.get('feature_area')} team={r.get('team')}")
                updated += len(chunk)
                continue
            for fid, r in chunk:
                conn.execute(
                    """UPDATE feedback SET
                        feature_area = ?, team = ?, urgency = ?, confidence = ?,
                        product = ?, feedback_type = ?, sentiment = ?, sentiment_score = ?
                    WHERE id = ?""",
                    (
                        r.get("feature_area"),
                        r.get("team"),
                        r.get("urgency") or "medium",
                        _to_float(r.get("confidence")) or 0.0,
                        r.get("product"),
                        r.get("feedback_type"),
                        r.get("sentiment"),
                        _to_float(r.get("sentiment_score")) or 0.0,
                        fid,
                    ),
                )
                updated += 1
            conn.commit()

    asyncio.run(process_all())

    conn.close()
    print(f"Done. Updated={updated}, Failed={failed}")


if __name__ == "__main__":
    main()
