"""DB operations for the QuickStock pipeline — PostgreSQL edition."""
import json
import logging
from typing import Any, Optional

from app.db.connection import get_connection, get_cursor

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tickets
# ---------------------------------------------------------------------------

def get_next_ticket_id() -> str:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT ticket_id FROM tickets WHERE ticket_id LIKE 'TKT-%%' "
                "ORDER BY created_at DESC, id DESC LIMIT 1"
            )
            row = cur.fetchone()
    if not row:
        return "TKT-001"
    try:
        num = int(row["ticket_id"].split("-", 1)[1])
        return f"TKT-{num + 1:03d}"
    except (ValueError, IndexError):
        return "TKT-001"


def ticket_exists_and_active(ticket_id: str) -> bool:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT status FROM tickets WHERE ticket_id = %s", (ticket_id,)
            )
            row = cur.fetchone()
    if not row:
        return False
    active = (
        "received", "classifying", "analyzing", "researching",
        "finding_stores", "calling_stores",
    )
    return row["status"] in active


def create_ticket(
    ticket_id: str, query: str, location: str,
    user_phone: Optional[str] = None, user_name: Optional[str] = None,
) -> dict[str, Any]:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "INSERT INTO tickets (ticket_id, query, location, user_phone, user_name, status) "
                "VALUES (%s, %s, %s, %s, %s, 'received') "
                "RETURNING id, ticket_id, status, created_at",
                (ticket_id, query, location, user_phone, user_name),
            )
            row = cur.fetchone()
    return {"id": row["id"], "ticket_id": row["ticket_id"],
            "status": row["status"], "created_at": str(row["created_at"])}


def update_ticket_status(ticket_id: str, status: str, *, error_message: Optional[str] = None) -> None:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "UPDATE tickets SET status = %s, error_message = %s, updated_at = NOW() "
                "WHERE ticket_id = %s",
                (status, error_message, ticket_id),
            )


def update_ticket_query_type(ticket_id: str, query_type: str) -> None:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "UPDATE tickets SET query_type = %s, updated_at = NOW() WHERE ticket_id = %s",
                (query_type, ticket_id),
            )


def set_ticket_final_result(ticket_id: str, result: dict) -> None:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "UPDATE tickets SET final_result = %s, status = 'completed', "
                "updated_at = NOW() WHERE ticket_id = %s",
                (json.dumps(result, default=str), ticket_id),
            )


def get_ticket(ticket_id: str) -> Optional[dict[str, Any]]:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT id, ticket_id, query, location, user_phone, user_name, query_type, "
                "status, bolna_call_id, final_result, error_message, created_at, updated_at "
                "FROM tickets WHERE ticket_id = %s",
                (ticket_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    result = dict(row)
    result["created_at"] = str(result["created_at"]) if result.get("created_at") else None
    result["updated_at"] = str(result["updated_at"]) if result.get("updated_at") else None
    if result.get("final_result"):
        try:
            result["final_result"] = json.loads(result["final_result"])
        except (json.JSONDecodeError, TypeError):
            pass
    return result


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

def save_product(ticket_id: str, product: dict[str, Any]) -> int:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "INSERT INTO ticket_products "
                "(ticket_id, product_name, product_category, product_specs, "
                "avg_price_online, alternatives, store_search_query) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (
                    ticket_id,
                    product["product_name"],
                    product.get("product_category"),
                    json.dumps(product.get("specs") or {}),
                    product.get("avg_price_online"),
                    json.dumps(product.get("alternatives") or []),
                    product.get("store_search_query"),
                ),
            )
            return cur.fetchone()["id"]


def get_product(ticket_id: str) -> Optional[dict[str, Any]]:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT id, product_name, product_category, product_specs, "
                "avg_price_online, alternatives, store_search_query "
                "FROM ticket_products WHERE ticket_id = %s ORDER BY id DESC LIMIT 1",
                (ticket_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    result = dict(row)
    result["specs"] = json.loads(result.pop("product_specs") or "{}")
    result["alternatives"] = json.loads(result.get("alternatives") or "[]")
    result["avg_price_online"] = float(result["avg_price_online"]) if result["avg_price_online"] else None
    return result


# ---------------------------------------------------------------------------
# Stores
# ---------------------------------------------------------------------------

def save_stores(ticket_id: str, stores: list[dict[str, Any]]) -> list[int]:
    ids = []
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            for idx, s in enumerate(stores):
                place_id = s.get("place_id")
                if place_id:
                    cur.execute(
                        "SELECT id FROM ticket_stores WHERE ticket_id = %s AND place_id = %s",
                        (ticket_id, place_id),
                    )
                    existing = cur.fetchone()
                    if existing:
                        ids.append(existing["id"])
                        continue
                cur.execute(
                    "INSERT INTO ticket_stores "
                    "(ticket_id, store_name, address, phone_number, rating, total_ratings, "
                    "place_id, latitude, longitude, call_priority) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                    (
                        ticket_id, s["name"], s.get("address"), s.get("phone_number"),
                        s.get("rating"), s.get("total_ratings"), place_id,
                        s.get("latitude"), s.get("longitude"), idx + 1,
                    ),
                )
                ids.append(cur.fetchone()["id"])
    return ids


def update_store_priorities(ticket_id: str, ordered_place_ids: list[str]) -> None:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            for priority, place_id in enumerate(ordered_place_ids, 1):
                cur.execute(
                    "UPDATE ticket_stores SET call_priority = %s WHERE ticket_id = %s AND place_id = %s",
                    (priority, ticket_id, place_id),
                )


def get_stores(ticket_id: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT id, store_name, address, phone_number, rating, total_ratings, "
                "place_id, call_priority FROM ticket_stores WHERE ticket_id = %s "
                "ORDER BY call_priority, id",
                (ticket_id,),
            )
            rows = cur.fetchall()
    seen_place_ids: set[str] = set()
    stores = []
    for r in rows:
        pid = r["place_id"]
        if pid and pid in seen_place_ids:
            continue
        if pid:
            seen_place_ids.add(pid)
        stores.append({
            "id": r["id"], "store_name": r["store_name"], "address": r["address"],
            "phone_number": r["phone_number"],
            "rating": float(r["rating"]) if r["rating"] else None,
            "total_ratings": r["total_ratings"], "place_id": pid,
            "call_priority": r["call_priority"],
        })
    return stores


def get_store_by_id(store_id: int) -> Optional[dict[str, Any]]:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT id, ticket_id, store_name, address, phone_number, rating, "
                "total_ratings, place_id, latitude, longitude, call_priority "
                "FROM ticket_stores WHERE id = %s",
                (store_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    return dict(row)


# ---------------------------------------------------------------------------
# Store calls
# ---------------------------------------------------------------------------

def create_store_call(ticket_id: str, store_id: int) -> int:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "INSERT INTO store_calls (ticket_id, store_id, status) "
                "VALUES (%s, %s, 'pending') RETURNING id",
                (ticket_id, store_id),
            )
            return cur.fetchone()["id"]


def update_store_call_bolna_id(call_id: int, bolna_call_id: str) -> None:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "UPDATE store_calls SET bolna_call_id = %s, status = 'calling', "
                "updated_at = NOW() WHERE id = %s",
                (bolna_call_id, call_id),
            )


def update_store_call_status(call_id: int, status: str) -> None:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "UPDATE store_calls SET status = %s, updated_at = NOW() WHERE id = %s",
                (status, call_id),
            )


def get_store_call_by_bolna_id(bolna_call_id: str) -> Optional[dict[str, Any]]:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT sc.id, sc.ticket_id, sc.store_id, sc.status, "
                "ts.store_name, ts.phone_number "
                "FROM store_calls sc "
                "JOIN ticket_stores ts ON ts.id = sc.store_id "
                "WHERE sc.bolna_call_id = %s",
                (bolna_call_id,),
            )
            row = cur.fetchone()
    return dict(row) if row else None


def save_store_call_transcript(
    bolna_call_id: str,
    transcript: str,
    transcript_messages: list[dict] | None = None,
) -> Optional[int]:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "UPDATE store_calls SET transcript = %s, transcript_json = %s, "
                "status = 'transcript_received', updated_at = NOW() "
                "WHERE bolna_call_id = %s",
                (
                    transcript,
                    json.dumps(transcript_messages, default=str) if transcript_messages else None,
                    bolna_call_id,
                ),
            )
            cur.execute(
                "SELECT id FROM store_calls WHERE bolna_call_id = %s", (bolna_call_id,)
            )
            row = cur.fetchone()
    return row["id"] if row else None


def save_store_call_analysis(call_id: int, analysis: dict[str, Any]) -> None:
    notes_parts = []
    if analysis.get("call_summary"):
        notes_parts.append(analysis["call_summary"])
    if analysis.get("notes"):
        notes_parts.append(analysis["notes"])
    combined_notes = " | ".join(notes_parts) if notes_parts else None

    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "UPDATE store_calls SET "
                "call_analysis = %s, product_available = %s, matched_product = %s, price = %s, "
                "delivery_available = %s, delivery_eta = %s, delivery_mode = %s, delivery_charge = %s, "
                "product_match_type = %s, notes = %s, status = 'analyzed', "
                "updated_at = NOW() WHERE id = %s",
                (
                    json.dumps(analysis, default=str),
                    True if analysis.get("product_available") is True else (
                        False if analysis.get("product_available") is False else None
                    ),
                    analysis.get("matched_product"),
                    analysis.get("price"),
                    True if analysis.get("delivery_available") is True else (
                        False if analysis.get("delivery_available") is False else None
                    ),
                    analysis.get("delivery_eta"),
                    analysis.get("delivery_mode"),
                    analysis.get("delivery_charge"),
                    analysis.get("product_match_type"),
                    combined_notes,
                    call_id,
                ),
            )


def get_store_calls_for_ticket(ticket_id: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT sc.id, sc.store_id, sc.bolna_call_id, sc.status, "
                "sc.product_available, sc.matched_product, sc.price, "
                "sc.delivery_available, sc.delivery_eta, sc.delivery_mode, "
                "sc.delivery_charge, sc.product_match_type, sc.notes, "
                "sc.call_analysis, ts.store_name, ts.phone_number, ts.rating, "
                "ts.address, sc.transcript, sc.transcript_json "
                "FROM store_calls sc "
                "JOIN ticket_stores ts ON ts.id = sc.store_id "
                "WHERE sc.ticket_id = %s ORDER BY ts.call_priority",
                (ticket_id,),
            )
            rows = cur.fetchall()

    result = []
    for r in rows:
        row = dict(r)
        row["price"] = float(row["price"]) if row["price"] else None
        row["delivery_charge"] = float(row["delivery_charge"]) if row["delivery_charge"] else None
        row["rating"] = float(row["rating"]) if row["rating"] else None
        try:
            row["call_analysis"] = json.loads(row["call_analysis"] or "{}")
        except (json.JSONDecodeError, TypeError):
            row["call_analysis"] = {}
        try:
            row["transcript_json"] = json.loads(row["transcript_json"] or "null")
        except (json.JSONDecodeError, TypeError):
            row["transcript_json"] = None
        result.append(row)
    return result


def count_pending_calls(ticket_id: str) -> int:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM store_calls WHERE ticket_id = %s "
                "AND status NOT IN ('analyzed', 'failed')",
                (ticket_id,),
            )
            row = cur.fetchone()
    return row["cnt"] if row else 0


# ---------------------------------------------------------------------------
# Web deals
# ---------------------------------------------------------------------------

def save_web_deals(ticket_id: str, result: dict[str, Any]) -> int:
    deals = result.get("deals") or []
    best_deal = result.get("best_deal")
    price_range = result.get("price_range")
    grounding = result.get("_grounding_metadata")
    status = "error" if result.get("error") else "completed"
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "INSERT INTO web_deals "
                "(ticket_id, product_searched, search_summary, deals, best_deal, "
                "surprise_finds, price_range, grounding_metadata, status, error_message) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (
                    ticket_id,
                    result.get("product_searched"),
                    result.get("search_summary"),
                    json.dumps(deals, default=str),
                    json.dumps(best_deal, default=str) if best_deal else None,
                    result.get("surprise_finds"),
                    json.dumps(price_range, default=str) if price_range else None,
                    json.dumps(grounding, default=str) if grounding else None,
                    status,
                    result.get("error"),
                ),
            )
            return cur.fetchone()["id"]


def get_web_deals(ticket_id: str) -> Optional[dict[str, Any]]:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT id, product_searched, search_summary, deals, best_deal, "
                "surprise_finds, price_range, grounding_metadata, status, error_message, created_at "
                "FROM web_deals WHERE ticket_id = %s ORDER BY id DESC LIMIT 1",
                (ticket_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    r = dict(row)
    try:
        r["deals"] = json.loads(r.get("deals") or "[]")
    except (json.JSONDecodeError, TypeError):
        r["deals"] = []
    try:
        r["best_deal"] = json.loads(r.get("best_deal") or "null")
    except (json.JSONDecodeError, TypeError):
        r["best_deal"] = None
    return r


# ---------------------------------------------------------------------------
# LLM logs
# ---------------------------------------------------------------------------

def log_llm_call(
    ticket_id: str, step: str, model: str, prompt_template: str,
    input_data: Any, output_data: Any, raw_response: str,
    tokens_input: int = 0, tokens_output: int = 0, latency_ms: int = 0,
) -> int:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "INSERT INTO llm_logs "
                "(ticket_id, step, model, prompt_template, input_data, output_data, "
                "raw_response, tokens_input, tokens_output, latency_ms) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (
                    ticket_id, step, model, prompt_template,
                    json.dumps(input_data, default=str),
                    json.dumps(output_data, default=str),
                    raw_response, tokens_input, tokens_output, latency_ms,
                ),
            )
            return cur.fetchone()["id"]


# ---------------------------------------------------------------------------
# Tool call logs
# ---------------------------------------------------------------------------

def log_tool_call(
    ticket_id: str, tool_name: str, input_params: Any, output_result: Any,
    status: str = "success", error_message: Optional[str] = None,
    store_call_id: Optional[int] = None, latency_ms: int = 0,
) -> int:
    with get_connection() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "INSERT INTO tool_call_logs "
                "(ticket_id, store_call_id, tool_name, input_params, output_result, "
                "status, error_message, latency_ms) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (
                    ticket_id, store_call_id, tool_name,
                    json.dumps(input_params, default=str),
                    json.dumps(output_result, default=str),
                    status, error_message, latency_ms,
                ),
            )
            return cur.fetchone()["id"]
