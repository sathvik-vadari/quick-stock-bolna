"""Transcript Analyzer — post-call LLM analysis of store transcripts."""
import json
import time
import logging
from typing import Any

from openai import AsyncAzureOpenAI

from app.helpers.config import Config
from app.helpers.prompt_loader import PromptLoader
from app.db.tickets import (
    log_llm_call,
    save_store_call_analysis,
    get_store_calls_for_ticket,
    get_product,
    get_ticket,
    get_web_deals,
    count_pending_calls,
    set_ticket_final_result,
    update_ticket_status,
)

logger = logging.getLogger(__name__)

_client: AsyncAzureOpenAI | None = None


def _get_client() -> AsyncAzureOpenAI:
    global _client
    if _client is None:
        _client = AsyncAzureOpenAI(
            api_key=Config.AZURE_OPENAI_API_KEY,
            azure_endpoint=Config.AZURE_OPENAI_ENDPOINT,
            api_version=Config.AZURE_OPENAI_API_VERSION,
        )
    return _client


async def analyze_transcript(
    ticket_id: str,
    store_call_id: int,
    transcript: str,
    ended_reason: str = "",
) -> dict[str, Any]:
    """
    Analyze a store call transcript and extract structured availability data.
    Persists analysis to DB and checks if the ticket is complete.
    """
    loader = PromptLoader()
    system_prompt = loader.load_prompt("transcript_analyzer") or "Analyze transcript. Respond JSON."

    product = get_product(ticket_id)
    product_context = ""
    if product:
        specs = product.get("specs") or {}
        specs_lines = "\n".join(f"    - {k}: {v}" for k, v in specs.items()) if specs else "    (none)"
        alts = product.get("alternatives") or []
        alts_lines = "\n".join(f"    - {a.get('name', '?')}" for a in alts) if alts else "    (none)"
        product_context = (
            f"\nOriginal product request:\n"
            f"  Product: {product['product_name']}\n"
            f"  Category: {product.get('product_category')}\n"
            f"  Required specs:\n{specs_lines}\n"
            f"  Alternatives:\n{alts_lines}\n"
        )

    ended_context = f"\nCall ended reason: {ended_reason}\n" if ended_reason else ""

    user_message = f"TRANSCRIPT:\n{transcript}\n{product_context}{ended_context}"

    start = time.time()
    client = _get_client()

    resp = await client.chat.completions.create(
        model=Config.AZURE_OPENAI_DEPLOYMENT,
        temperature=0.0,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
    )
    raw = resp.choices[0].message.content or "{}"
    latency = int((time.time() - start) * 1000)
    analysis = json.loads(raw)

    log_llm_call(
        ticket_id=ticket_id, step="transcript_analyzer", model=Config.AZURE_OPENAI_DEPLOYMENT,
        prompt_template="transcript_analyzer.txt",
        input_data={"store_call_id": store_call_id, "transcript_length": len(transcript)},
        output_data=analysis, raw_response=raw,
        tokens_input=resp.usage.prompt_tokens if resp.usage else 0,
        tokens_output=resp.usage.completion_tokens if resp.usage else 0,
        latency_ms=latency,
    )

    save_store_call_analysis(store_call_id, analysis)

    pending = count_pending_calls(ticket_id)
    if pending == 0:
        await _compile_final_result(ticket_id)

    return analysis


async def _compile_final_result(ticket_id: str) -> None:
    """Once all store calls are done, compile the best result."""
    calls = get_store_calls_for_ticket(ticket_id)
    product = get_product(ticket_id)
    ticket = get_ticket(ticket_id)

    if not calls:
        update_ticket_status(ticket_id, "completed", error_message="No store call data available")
        return

    product_name = product["product_name"] if product else (ticket.get("query") if ticket else "unknown")
    customer_specs = product.get("specs") or {} if product else {}

    connected_calls, failed_calls = [], []
    for c in calls:
        analysis = c.get("call_analysis") or {}
        was_connected = analysis.get("call_connected", c["status"] == "analyzed")
        entry = {
            **c,
            "_connected": was_connected,
            "_summary": analysis.get("call_summary", c.get("notes") or ""),
            "_specs_gathered": analysis.get("specs_gathered") or {},
            "_specs_match": analysis.get("specs_match_score", 0.0),
            "_data_quality": analysis.get("data_quality_score", 0.0),
        }
        if was_connected and c.get("product_available") is not None:
            connected_calls.append(entry)
        else:
            failed_calls.append(entry)

    available_calls = [c for c in connected_calls if c.get("product_available")]

    if not available_calls:
        no_result = {
            "status": "no_availability",
            "product_requested": product_name,
            "customer_specs": customer_specs,
            "message": "None of the contacted stores have the requested product.",
            "stores_contacted": len(calls),
            "calls_connected": len(connected_calls),
            "calls_failed": len(failed_calls),
            "call_details": [
                {
                    "store_name": c.get("store_name"),
                    "status": "connected" if c["_connected"] else "not_connected",
                    "summary": c["_summary"],
                    "product_available": c.get("product_available"),
                    "notes": c.get("notes"),
                }
                for c in connected_calls + failed_calls
            ],
        }
        web_deals = get_web_deals(ticket_id)
        if web_deals and web_deals.get("deals"):
            no_result["web_deals"] = web_deals
            no_result["message"] = (
                "None of the local stores had the product, but we found online deals!"
            )
        set_ticket_final_result(ticket_id, no_result)
        return

    scored = []
    for c in available_calls:
        match_score = {"exact": 4, "close": 3, "alternative": 2, "no_match": 0, "no_data": 0}.get(
            c.get("product_match_type") or "", 0
        )
        composite = (match_score * 3) + (float(c.get("_specs_match") or 0) * 2) + float(c.get("_data_quality") or 0)
        scored.append({**c, "_composite_score": composite})

    scored.sort(key=lambda x: (-x["_composite_score"], x.get("price") or 999999))
    best = scored[0]

    all_options = []
    for idx, s in enumerate(scored):
        analysis = s.get("call_analysis") or {}
        all_options.append({
            "rank": idx + 1,
            "store_name": s.get("store_name"),
            "phone_number": s.get("phone_number"),
            "address": s.get("address"),
            "rating": s.get("rating"),
            "matched_product": s.get("matched_product"),
            "price": s.get("price"),
            "product_match_type": s.get("product_match_type"),
            "specs_gathered": s.get("_specs_gathered"),
            "specs_match_score": s.get("_specs_match"),
            "delivery_available": s.get("delivery_available"),
            "delivery_eta": s.get("delivery_eta"),
            "delivery_mode": s.get("delivery_mode"),
            "delivery_charge": s.get("delivery_charge"),
            "call_summary": s.get("_summary"),
            "notes": s.get("notes"),
        })

    final = {
        "status": "found",
        "product_requested": product_name,
        "customer_specs": customer_specs,
        "best_option": all_options[0],
        "all_options": all_options,
        "stores_contacted": len(calls),
        "calls_connected": len(connected_calls),
        "stores_with_product": len(available_calls),
    }

    web_deals = get_web_deals(ticket_id)
    if web_deals and web_deals.get("deals"):
        final["web_deals"] = web_deals

    set_ticket_final_result(ticket_id, final)
    logger.info(
        "Ticket %s completed — best: %s (₹%s)",
        ticket_id, best.get("store_name"), best.get("price"),
    )
