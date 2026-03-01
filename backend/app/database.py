"""SQLite connection, table creation, and Mistral connection verification."""
import asyncio
import logging
import os
import sqlite3
from typing import Generator

from app.config import settings

logger = logging.getLogger(__name__)


def _ensure_db_dir() -> None:
    """Ensure the directory for the database file exists."""
    path = settings.database_path
    dir_path = os.path.dirname(path)
    if dir_path:
        os.makedirs(dir_path, exist_ok=True)


def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Yield a database connection. Use as FastAPI Depends(get_db)."""
    _ensure_db_dir()
    conn = sqlite3.connect(settings.database_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.close()


def get_db_sync() -> sqlite3.Connection:
    """Return a synchronous DB connection for use in lifespan/background tasks (e.g. connector poller)."""
    _ensure_db_dir()
    conn = sqlite3.connect(settings.database_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Create all tables and indexes on startup. Organizations before users (FK)."""
    _ensure_db_dir()
    conn = sqlite3.connect(settings.database_path)
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        cursor = conn.cursor()
        # Organizations first (referenced by users)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS organizations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT DEFAULT 'pm',
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                text TEXT NOT NULL,
                source TEXT,
                author_name TEXT,
                is_feedback BOOLEAN DEFAULT 1,
                feedback_type TEXT,
                sentiment TEXT,
                sentiment_score REAL,
                product TEXT,
                feature_area TEXT,
                team TEXT,
                urgency TEXT DEFAULT 'medium',
                confidence REAL,
                rating INTEGER,
                customer_id TEXT,
                customer_name TEXT,
                customer_segment TEXT,
                tags TEXT,
                embedding BLOB,
                created_at TEXT,
                ingested_at TEXT DEFAULT (datetime('now')),
                ingestion_method TEXT DEFAULT 'csv_upload',
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                company_name TEXT NOT NULL,
                segment TEXT,
                plan TEXT,
                mrr REAL DEFAULT 0,
                arr REAL DEFAULT 0,
                account_manager TEXT,
                renewal_date TEXT,
                health_score INTEGER DEFAULT 50,
                employee_count INTEGER,
                industry TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS product_context (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                section TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS specs (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                status TEXT DEFAULT 'draft',
                prd TEXT,
                architecture TEXT,
                rules TEXT,
                plan TEXT,
                feedback_ids TEXT,
                customer_ids TEXT,
                arr_impacted REAL DEFAULT 0,
                rice_score REAL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                title TEXT DEFAULT 'New Conversation',
                messages TEXT NOT NULL DEFAULT '[]',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS upload_history (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                upload_id TEXT NOT NULL UNIQUE,
                upload_type TEXT NOT NULL,
                filename TEXT NOT NULL,
                total_rows INTEGER DEFAULT 0,
                imported_rows INTEGER DEFAULT 0,
                failed_rows INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                processed INTEGER DEFAULT 0,
                result_data TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                temp_file_path TEXT,
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS connectors (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT DEFAULT 'disconnected',
                config TEXT DEFAULT '{}',
                last_sync_at TEXT,
                messages_processed INTEGER DEFAULT 0,
                noise_filtered INTEGER DEFAULT 0,
                last_error TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS connector_sync_history (
                id TEXT PRIMARY KEY,
                connector_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                messages_count INTEGER DEFAULT 0,
                noise_filtered INTEGER DEFAULT 0,
                channel_or_detail TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (connector_id) REFERENCES connectors(id)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_logs (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                agent_type TEXT,
                tool_used TEXT,
                latency_ms INTEGER,
                model TEXT,
                tokens_in INTEGER DEFAULT 0,
                tokens_out INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (org_id) REFERENCES organizations(id)
            )
        """)
        # Indexes
        for idx_sql in (
            "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
            "CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id)",
            "CREATE INDEX IF NOT EXISTS idx_feedback_org ON feedback(org_id)",
            "CREATE INDEX IF NOT EXISTS idx_feedback_org_ingested ON feedback(org_id, ingested_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_feedback_feature ON feedback(org_id, feature_area)",
            "CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON feedback(org_id, sentiment)",
            "CREATE INDEX IF NOT EXISTS idx_feedback_customer ON feedback(org_id, customer_id)",
            "CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(org_id)",
            "CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(org_id, company_name)",
            "CREATE INDEX IF NOT EXISTS idx_product_context_org ON product_context(org_id, section)",
            "CREATE INDEX IF NOT EXISTS idx_specs_org ON specs(org_id)",
            "CREATE INDEX IF NOT EXISTS idx_conversations_org ON conversations(org_id, user_id)",
            "CREATE INDEX IF NOT EXISTS idx_upload_history_org ON upload_history(org_id)",
            "CREATE INDEX IF NOT EXISTS idx_connectors_org ON connectors(org_id)",
            "CREATE INDEX IF NOT EXISTS idx_connector_sync_history_connector ON connector_sync_history(connector_id)",
            "CREATE INDEX IF NOT EXISTS idx_agent_logs_org ON agent_logs(org_id)",
            "CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at DESC)",
        ):
            cursor.execute(idx_sql)
        conn.commit()
    finally:
        conn.close()
    logger.info("SQLite database initialized")


def _verify_mistral_sync() -> bool:
    """Synchronous Mistral API check (run in thread)."""
    try:
        from mistralai import Mistral
        client = Mistral(api_key=settings.mistral_api_key)
        client.chat.complete(
            model="mistral-small-latest",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=5,
        )
        return True
    except Exception as e:
        logger.error("Mistral connection failed: %s", e)
        return False


async def verify_mistral_connection() -> bool:
    """Test Mistral API (non-blocking via thread)."""
    return await asyncio.to_thread(_verify_mistral_sync)
