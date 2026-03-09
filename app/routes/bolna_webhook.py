"""Bolna webhook — receives call events when a store inquiry call ends."""
import asyncio
import logging

from fastapi import APIRouter, Request, Response

from app.db.tickets import (
    get_store_call_by_bolna_id,
    save_store_call_transcript,
    save_store_call_analysis,
    update_store_call_status,
    update_store_call_bolna_id,
    count_pending_calls,
    get_store_call_retry_info,
    set_store_call_retry_scheduled,
    get_product,
    get_ticket,
    log_tool_call,
)
from app.services.transcript_analyzer import analyze_transcript, _compile_final_result
from app.services.bolna_client import create_store_phone_call

logger = logging.getLogger(__name__)

router = APIRouter(tags=["bolna-webhook"])


@router.post("/api/bolna/webhook")
async def bolna_webhook(request: Request) -> Response:
    """
    Receives Bolna webhook events for store inquiry calls.

    Bolna sends a POST when a call ends with:
      - call_id / conversation_id
      - call_status: "completed" | "busy" | "failed" | "no-answer"
      - transcript: full conversation text
      - messages: list of {role, content} dicts
      - user_data: dict we passed when initiating the call (contains ticket_id, store_call_id)
    """
    try:
        body = await request.json()
    except Exception as e:
        logger.warning("Bolna webhook invalid JSON: %s", e)
        return Response(status_code=400, content=b"Invalid JSON")

    call_id = body.get("call_id") or body.get("execution_id") or body.get("conversation_id") or body.get("id")
    call_status = body.get("call_status") or body.get("status") or ""
    transcript = (body.get("transcript") or "").strip()
    messages = body.get("messages") or []
    user_data = body.get("user_data") or body.get("context_details") or {}

    # Routing: ticket_id and store_call_id are embedded in user_data
    ticket_id = user_data.get("ticket_id")
    store_call_id = user_data.get("store_call_id")

    logger.info(
        "Bolna webhook: call_id=%s status=%s ticket=%s store_call=%s transcript_len=%d",
        call_id, call_status, ticket_id, store_call_id, len(transcript),
    )

    terminal_statuses = {"completed", "busy", "failed", "no-answer", "no_answer",
                         "canceled", "cancelled", "error", "call-disconnected",
                         "balance-low"}

    if call_status.lower() not in terminal_statuses:
        # Non-terminal event (e.g. ringing, in-progress) — acknowledge and ignore
        return Response(status_code=200, content=b'{"status":"ok"}', media_type="application/json")

    if not call_id:
        logger.warning("Bolna webhook missing call_id")
        return Response(status_code=200, content=b'{"status":"ok"}', media_type="application/json")

    if transcript or messages:
        asyncio.create_task(
            _handle_call_transcript(call_id, transcript, messages, call_status)
        )
    else:
        asyncio.create_task(
            _handle_no_transcript(call_id, call_status, ticket_id, store_call_id)
        )

    return Response(status_code=200, content=b'{"status":"ok"}', media_type="application/json")


async def _handle_call_transcript(
    bolna_call_id: str,
    transcript: str,
    messages: list[dict] | None,
    ended_reason: str,
) -> None:
    """Background task: save transcript and run transcript analyzer LLM."""
    try:
        sc = get_store_call_by_bolna_id(bolna_call_id)
        if not sc:
            logger.warning("No store_call found for bolna_call_id=%s", bolna_call_id)
            return

        if sc["status"] in ("analyzed", "failed"):
            logger.info("Store call %s already %s, skipping duplicate webhook", sc["id"], sc["status"])
            return

        call_id_db = save_store_call_transcript(bolna_call_id, transcript, messages or [])
        if not call_id_db:
            logger.warning("Failed to save transcript for bolna_call_id=%s", bolna_call_id)
            return

        await analyze_transcript(
            ticket_id=sc["ticket_id"],
            store_call_id=call_id_db,
            transcript=transcript,
            ended_reason=ended_reason,
        )
        logger.info(
            "Transcript analysis complete for store_call %s (ticket %s)",
            call_id_db, sc["ticket_id"],
        )

    except Exception:
        logger.exception("Store transcript handling failed for bolna_call_id=%s", bolna_call_id)


CALL_RETRY_DELAY_SECONDS = 120

_RETRYABLE_STATUSES = {"no-answer", "no_answer", "busy"}

_FAILURE_NOTES = {
    "busy": "Store line was busy",
    "no-answer": "Store did not answer",
    "no_answer": "Store did not answer",
    "failed": "Call failed to connect",
    "canceled": "Call was cancelled",
    "error": "Call encountered an error",
}


async def _handle_no_transcript(
    bolna_call_id: str,
    ended_reason: str,
    ticket_id: str | None,
    store_call_id: int | None,
) -> None:
    """Handle calls that ended without a transcript (busy, no answer, etc.).

    If the call is retryable (no-answer/busy) and hasn't been retried yet,
    schedule a retry after CALL_RETRY_DELAY_SECONDS. Otherwise mark as failed.
    """
    try:
        sc = get_store_call_by_bolna_id(bolna_call_id)
        if not sc:
            logger.warning(
                "No store_call found for bolna_call_id=%s (no transcript)", bolna_call_id
            )
            return

        if sc["status"] in ("analyzed", "failed"):
            logger.info("Store call %s already %s, skipping duplicate webhook", sc["id"], sc["status"])
            return

        retry_info = get_store_call_retry_info(sc["id"])
        retry_count = (retry_info or {}).get("retry_count") or 0
        is_retryable = ended_reason.lower() in _RETRYABLE_STATUSES and retry_count < 1

        if is_retryable and retry_info and retry_info.get("phone_number"):
            logger.info(
                "Store call %s: %s — scheduling retry in %ds (attempt %d)",
                sc["id"], ended_reason, CALL_RETRY_DELAY_SECONDS, retry_count + 1,
            )
            set_store_call_retry_scheduled(sc["id"])
            asyncio.create_task(
                _retry_store_call(sc["id"], sc["ticket_id"], ended_reason)
            )
            return

        note = _FAILURE_NOTES.get(ended_reason.lower(), f"Call ended: {ended_reason}")
        if retry_count > 0:
            note = f"{note} (after {retry_count} retry)"

        save_store_call_analysis(sc["id"], {
            "product_available": None,
            "matched_product": None,
            "price": None,
            "delivery_available": None,
            "delivery_eta": None,
            "delivery_mode": None,
            "delivery_charge": None,
            "product_match_type": "no_data",
            "notes": note,
            "data_quality_score": 0.0,
            "ended_reason": ended_reason,
            "call_connected": False,
        })

        logger.info(
            "Store call %s (bolna=%s) ended without transcript: %s",
            sc["id"], bolna_call_id, note,
        )

        pending = count_pending_calls(sc["ticket_id"])
        if pending == 0:
            await _compile_final_result(sc["ticket_id"])

    except Exception:
        logger.exception("Failed handling no-transcript call for bolna_call_id=%s", bolna_call_id)


async def _retry_store_call(call_id: int, ticket_id: str, original_reason: str) -> None:
    """Wait CALL_RETRY_DELAY_SECONDS then re-initiate the Bolna call."""
    await asyncio.sleep(CALL_RETRY_DELAY_SECONDS)

    try:
        retry_info = get_store_call_retry_info(call_id)
        if not retry_info:
            logger.warning("Retry aborted: store_call %s not found", call_id)
            return

        phone = retry_info["phone_number"]
        ticket = get_ticket(ticket_id)
        product = get_product(ticket_id)
        if not ticket or not product:
            logger.warning("Retry aborted: missing ticket/product for %s", ticket_id)
            update_store_call_status(call_id, "failed", ticket_id=ticket_id)
            _check_ticket_complete(ticket_id)
            return

        from app.helpers.regional import detect_region
        from app.services.store_caller import _build_user_data

        location = ticket["location"]
        customer_name = ticket.get("user_name") or "a customer"
        region = detect_region(location)
        store_dict = {
            "store_name": retry_info["store_name"],
            "address": retry_info.get("address"),
        }

        user_data = _build_user_data(
            product, location, store_dict, customer_name, region,
            ticket_id, call_id,
        )

        logger.info(
            "Retrying store call %s → %s (%s) for ticket %s",
            call_id, retry_info["store_name"], phone, ticket_id,
        )

        update_store_call_status(call_id, "calling", ticket_id=ticket_id)
        bolna_result = await create_store_phone_call(phone, user_data)

        if bolna_result.get("success"):
            new_call_id = bolna_result.get("call_id")
            if new_call_id:
                update_store_call_bolna_id(call_id, new_call_id, ticket_id=ticket_id)
            logger.info("Retry call placed for store_call %s, new bolna_id=%s", call_id, new_call_id)
        else:
            logger.error("Retry call failed for store_call %s: %s", call_id, bolna_result.get("error"))
            update_store_call_status(call_id, "failed", ticket_id=ticket_id)
            _check_ticket_complete(ticket_id)

        log_tool_call(
            ticket_id, "bolna_retry_store_call",
            {"store": retry_info["store_name"], "phone": phone, "retry_reason": original_reason},
            bolna_result,
            status="success" if bolna_result.get("success") else "error",
            error_message=bolna_result.get("error"),
            store_call_id=call_id,
        )

    except Exception:
        logger.exception("Retry failed for store_call %s", call_id)
        update_store_call_status(call_id, "failed", ticket_id=ticket_id)
        _check_ticket_complete(ticket_id)


def _check_ticket_complete(ticket_id: str) -> None:
    """If no pending calls remain, schedule final compilation."""
    pending = count_pending_calls(ticket_id)
    if pending == 0:
        asyncio.create_task(_compile_final_result(ticket_id))
