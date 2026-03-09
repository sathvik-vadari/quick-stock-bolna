"""Ticket API — the main entry point for the frontend."""
import asyncio
import json as _json
from typing import Optional

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.helpers.config import Config
from app.helpers.logger import setup_logger
from app.db.tickets import (
    create_ticket,
    get_ticket,
    get_next_ticket_id,
    ticket_exists_and_active,
    update_ticket_status,
    update_ticket_query_type,
    get_store_calls_for_ticket,
    get_product,
    get_stores,
    get_web_deals,
    list_tickets as db_list_tickets,
    get_dashboard_stats as db_get_dashboard_stats,
)
from app.services.product_research import research_product
from app.services.google_maps import find_stores
from app.services.store_caller import call_stores
from app.services.gemini_client import analyze_query, rerank_stores
from app.services.web_deals import search_web_deals
from app.services.options_summary import generate_options_summary

logger = setup_logger(__name__)

router = APIRouter(tags=["tickets"])


class TicketRequest(BaseModel):
    query: str
    location: str
    user_phone: str
    user_name: Optional[str] = None
    max_stores: Optional[int] = None
    test_mode: Optional[bool] = None
    test_phone: Optional[str] = None


class TicketResponse(BaseModel):
    ticket_id: str
    status: str
    message: str


# ---------------------------------------------------------------------------
# POST /api/ticket
# ---------------------------------------------------------------------------

@router.post("/api/ticket", response_model=TicketResponse)
async def create_ticket_endpoint(req: TicketRequest, bg: BackgroundTasks):
    ticket_id = get_next_ticket_id()

    if ticket_exists_and_active(ticket_id):
        return TicketResponse(
            ticket_id=ticket_id,
            status="rejected",
            message=f"Ticket {ticket_id} is already being processed.",
        )

    create_ticket(ticket_id, req.query, req.location, req.user_phone, req.user_name)
    logger.info("Ticket %s created: query=%r location=%r", ticket_id, req.query, req.location)

    is_test = req.test_mode if req.test_mode is not None else Config.TEST_MODE
    test_phone = req.test_phone or Config.TEST_PHONE or None
    max_stores = max(1, min(10, req.max_stores)) if req.max_stores else None

    bg.add_task(
        _process_ticket, ticket_id, req.query, req.location, req.user_phone,
        test_mode=is_test, test_phone=test_phone, max_stores=max_stores,
        user_name=req.user_name,
    )

    return TicketResponse(
        ticket_id=ticket_id,
        status="processing",
        message="Ticket received. Finding stores and initiating calls.",
    )


# ---------------------------------------------------------------------------
# Shared: build a full ticket status dict (used by REST + SSE)
# ---------------------------------------------------------------------------

def _build_ticket_response(ticket_id: str) -> dict:
    ticket = get_ticket(ticket_id)
    if not ticket:
        return {"error": "Ticket not found", "ticket_id": ticket_id}

    response: dict = {
        "ticket_id": ticket["ticket_id"],
        "status": ticket["status"],
        "query": ticket.get("query"),
        "location": ticket.get("location"),
        "user_phone": ticket.get("user_phone"),
        "user_name": ticket.get("user_name"),
        "created_at": ticket.get("created_at"),
        "updated_at": ticket.get("updated_at"),
    }

    if ticket.get("error_message"):
        response["error"] = ticket["error_message"]

    if ticket.get("final_result"):
        response["result"] = ticket["final_result"]

    product = get_product(ticket_id)
    if product:
        response["product"] = product

    stores = get_stores(ticket_id)
    if stores:
        response["stores"] = stores

    calls = get_store_calls_for_ticket(ticket_id)
    if calls:
        response["store_calls"] = calls
        response["progress"] = {
            "stores_found": len(stores),
            "calls_total": len(calls),
            "calls_completed": sum(1 for c in calls if c["status"] in ("analyzed", "failed")),
            "calls_in_progress": sum(1 for c in calls if c["status"] not in ("analyzed", "failed")),
        }

    web_deals = get_web_deals(ticket_id)
    if web_deals and web_deals.get("deals"):
        response["web_deals"] = {
            "search_summary": web_deals.get("search_summary"),
            "deals": web_deals.get("deals", []),
            "best_deal": web_deals.get("best_deal"),
            "surprise_finds": web_deals.get("surprise_finds"),
            "status": web_deals.get("status"),
        }

    return response


# ---------------------------------------------------------------------------
# GET /api/ticket/{ticket_id}
# ---------------------------------------------------------------------------

@router.get("/api/ticket/{ticket_id}")
async def get_ticket_status(ticket_id: str):
    return _build_ticket_response(ticket_id)


# ---------------------------------------------------------------------------
# GET /api/ticket/{ticket_id}/events  (SSE stream)
# ---------------------------------------------------------------------------

@router.get("/api/ticket/{ticket_id}/events")
async def ticket_events_stream(ticket_id: str):
    from app.helpers.events import TicketEvents

    async def generate():
        event = TicketEvents.subscribe(ticket_id)
        try:
            data = _build_ticket_response(ticket_id)
            yield f"data: {_json.dumps(data, default=str)}\n\n"

            while True:
                event.clear()
                try:
                    await asyncio.wait_for(event.wait(), timeout=30.0)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue

                data = _build_ticket_response(ticket_id)
                yield f"data: {_json.dumps(data, default=str)}\n\n"

                if data.get("status") in ("completed", "failed"):
                    break
        finally:
            TicketEvents.unsubscribe(ticket_id, event)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# GET /api/ticket/{ticket_id}/options
# ---------------------------------------------------------------------------

@router.get("/api/ticket/{ticket_id}/options")
async def get_ticket_options(ticket_id: str):
    result = await generate_options_summary(ticket_id)
    if "error" in result:
        from fastapi.responses import JSONResponse
        status_code = 404 if result["error"] == "Ticket not found" else 400
        return JSONResponse(status_code=status_code, content=result)
    return result


# ---------------------------------------------------------------------------
# GET /api/tickets — list all tickets
# ---------------------------------------------------------------------------

@router.get("/api/tickets")
async def list_tickets_endpoint(limit: int = 50, offset: int = 0):
    tickets = db_list_tickets(limit=min(limit, 100), offset=max(offset, 0))
    return {"tickets": tickets, "count": len(tickets)}


# ---------------------------------------------------------------------------
# GET /api/dashboard — aggregated stats
# ---------------------------------------------------------------------------

@router.get("/api/dashboard")
async def dashboard_stats():
    return db_get_dashboard_stats()


# ---------------------------------------------------------------------------
# Background pipeline
# ---------------------------------------------------------------------------

async def _process_ticket(
    ticket_id: str, query: str, location: str, user_phone: str,
    *, test_mode: bool = False, test_phone: Optional[str] = None,
    max_stores: Optional[int] = None, user_name: Optional[str] = None,
) -> None:
    try:
        # Step 1: Gemini query intelligence
        query_analysis = None
        try:
            update_ticket_status(ticket_id, "analyzing")
            query_analysis = await analyze_query(ticket_id, query, location)
            update_ticket_query_type(ticket_id, "order_product")
        except Exception as e:
            logger.warning("Gemini query analysis failed for ticket %s: %s", ticket_id, e)

        # Step 2: Product research
        update_ticket_status(ticket_id, "researching")
        product = await research_product(ticket_id, query, query_analysis=query_analysis)
        logger.info("Ticket %s product: %s", ticket_id, product.get("product_name"))

        # Step 3: Web deals in parallel with store discovery (best-effort)
        web_deals_task = asyncio.create_task(
            _search_web_deals_safe(ticket_id, query, product, location)
        )

        # Step 4: Find stores via Google Maps
        update_ticket_status(ticket_id, "finding_stores")
        search_queries = None
        if query_analysis and query_analysis.get("search_queries"):
            search_queries = query_analysis["search_queries"]
        elif product.get("_search_queries"):
            search_queries = product["_search_queries"]

        specific_store_name = None
        if query_analysis and query_analysis.get("is_specific_store"):
            specific_store_name = query_analysis.get("specific_store_name")

        preferred_retailers = product.get("preferred_retailers") or []
        if preferred_retailers:
            logger.info(
                "Ticket %s: price_tier=%s, preferred_retailers=%s",
                ticket_id, product.get("price_tier", "mid"), preferred_retailers,
            )

        stores = await find_stores(
            ticket_id,
            product.get("store_search_query", "store"),
            location,
            max_stores=max_stores,
            search_queries=search_queries,
            specific_store_name=specific_store_name,
            preferred_retailers=preferred_retailers,
        )
        logger.info("Ticket %s: found %d callable stores", ticket_id, len(stores))

        # Step 5: Gemini re-ranking (price-tier-aware)
        if query_analysis and stores and len(stores) > 1:
            try:
                reranked = await rerank_stores(ticket_id, query, stores, query_analysis, product=product)
                ordered_place_ids = [s.get("place_id") for s in reranked if s.get("place_id")]
                if ordered_place_ids:
                    from app.db.tickets import update_store_priorities
                    update_store_priorities(ticket_id, ordered_place_ids)
            except Exception as e:
                logger.warning("Store re-ranking failed for ticket %s: %s", ticket_id, e)

        if not stores:
            web_deals = await web_deals_task
            from app.db.tickets import set_ticket_final_result
            result = {
                "status": "no_stores",
                "message": "Could not find any stores with phone numbers near the given location.",
                "product": product.get("product_name"),
            }
            if web_deals and web_deals.get("deals"):
                result["status"] = "web_deals_only"
                result["message"] = "No local stores found, but we found online deals!"
                result["web_deals"] = web_deals
            set_ticket_final_result(ticket_id, result)
            return

        # Step 6: Call stores via Bolna
        update_ticket_status(ticket_id, "calling_stores")
        call_results = await call_stores(
            ticket_id, product, location,
            test_mode=test_mode,
            test_phone=test_phone or Config.TEST_PHONE,
            max_stores=max_stores,
            customer_name=user_name,
        )

        logger.info(
            "Ticket %s: initiated %d store calls (%d successful)",
            ticket_id, len(call_results),
            sum(1 for r in call_results if r["status"] == "calling"),
        )

        active_calls = [r for r in call_results if r["status"] == "calling"]
        if not active_calls:
            web_deals = await web_deals_task
            from app.db.tickets import set_ticket_final_result
            result = {
                "status": "call_failed",
                "message": "All store calls failed to initiate. Check Bolna config.",
                "product": product.get("product_name"),
            }
            if web_deals and web_deals.get("deals"):
                result["web_deals"] = web_deals
            set_ticket_final_result(ticket_id, result)

    except Exception as e:
        logger.exception("Pipeline failed for ticket %s", ticket_id)
        update_ticket_status(ticket_id, "failed", error_message=str(e))


async def _search_web_deals_safe(ticket_id: str, query: str, product: dict, location: str) -> dict:
    try:
        return await search_web_deals(ticket_id, query, product, location)
    except Exception as e:
        logger.warning("Web deals search failed for ticket %s: %s", ticket_id, e)
        return {"deals": [], "error": str(e)}
