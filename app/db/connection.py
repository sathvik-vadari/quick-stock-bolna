"""PostgreSQL database connection and schema initialization."""
import logging
import threading
from contextlib import contextmanager

import psycopg2
import psycopg2.extras

from app.helpers.config import Config

logger = logging.getLogger(__name__)

_lock = threading.Lock()


@contextmanager
def get_connection():
    conn = psycopg2.connect(Config.DATABASE_URL)
    conn.autocommit = False
    try:
        with _lock:
            yield conn
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _dict_row(cursor):
    """Convert a cursor row to a dict using column names."""
    if cursor.description is None:
        return None
    columns = [col.name for col in cursor.description]

    class DictRow(dict):
        def __getitem__(self, key):
            if isinstance(key, int):
                return list(self.values())[key]
            return super().__getitem__(key)

    def row_factory(row):
        return DictRow(zip(columns, row))

    return row_factory


@contextmanager
def get_cursor(conn):
    """Get a cursor that returns dict-like rows."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield cur
    finally:
        cur.close()


def init_db() -> None:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS tickets (
                    id SERIAL PRIMARY KEY,
                    ticket_id TEXT UNIQUE NOT NULL,
                    query TEXT NOT NULL,
                    location TEXT NOT NULL,
                    user_phone TEXT,
                    user_name TEXT,
                    query_type TEXT,
                    status TEXT NOT NULL DEFAULT 'received',
                    bolna_call_id TEXT,
                    final_result TEXT,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS ticket_products (
                    id SERIAL PRIMARY KEY,
                    ticket_id TEXT NOT NULL,
                    product_name TEXT NOT NULL,
                    product_category TEXT,
                    product_specs TEXT DEFAULT '{}',
                    avg_price_online DOUBLE PRECISION,
                    alternatives TEXT DEFAULT '[]',
                    store_search_query TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS ticket_stores (
                    id SERIAL PRIMARY KEY,
                    ticket_id TEXT NOT NULL,
                    store_name TEXT NOT NULL,
                    address TEXT,
                    phone_number TEXT,
                    rating DOUBLE PRECISION,
                    total_ratings INTEGER,
                    place_id TEXT,
                    latitude DOUBLE PRECISION,
                    longitude DOUBLE PRECISION,
                    call_priority INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS store_calls (
                    id SERIAL PRIMARY KEY,
                    ticket_id TEXT NOT NULL,
                    store_id INTEGER NOT NULL,
                    bolna_call_id TEXT,
                    status TEXT DEFAULT 'pending',
                    transcript TEXT,
                    transcript_json TEXT,
                    call_analysis TEXT DEFAULT '{}',
                    product_available BOOLEAN,
                    matched_product TEXT,
                    price DOUBLE PRECISION,
                    delivery_available BOOLEAN,
                    delivery_eta TEXT,
                    delivery_mode TEXT,
                    delivery_charge DOUBLE PRECISION,
                    product_match_type TEXT,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS web_deals (
                    id SERIAL PRIMARY KEY,
                    ticket_id TEXT NOT NULL,
                    product_searched TEXT,
                    search_summary TEXT,
                    deals TEXT DEFAULT '[]',
                    best_deal TEXT,
                    surprise_finds TEXT,
                    price_range TEXT,
                    grounding_metadata TEXT,
                    status TEXT DEFAULT 'completed',
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );

                -- Add options cache column if missing (idempotent)
                DO $$ BEGIN
                    ALTER TABLE tickets ADD COLUMN options_summary_cache TEXT;
                EXCEPTION WHEN duplicate_column THEN NULL;
                END $$;

                CREATE TABLE IF NOT EXISTS llm_logs (
                    id SERIAL PRIMARY KEY,
                    ticket_id TEXT NOT NULL,
                    step TEXT NOT NULL,
                    model TEXT NOT NULL,
                    prompt_template TEXT,
                    input_data TEXT,
                    output_data TEXT,
                    raw_response TEXT,
                    tokens_input INTEGER DEFAULT 0,
                    tokens_output INTEGER DEFAULT 0,
                    latency_ms INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS tool_call_logs (
                    id SERIAL PRIMARY KEY,
                    ticket_id TEXT NOT NULL,
                    store_call_id INTEGER,
                    tool_name TEXT NOT NULL,
                    input_params TEXT,
                    output_result TEXT,
                    status TEXT DEFAULT 'success',
                    error_message TEXT,
                    latency_ms INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """)

    logger.info("Database initialized (PostgreSQL: %s)", Config.DATABASE_URL.split("@")[-1] if "@" in Config.DATABASE_URL else "local")
