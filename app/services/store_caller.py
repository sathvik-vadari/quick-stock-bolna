"""Store Caller — orchestrates outbound Bolna calls to stores for product inquiry."""
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from app.helpers.config import Config
from app.helpers.regional import detect_region
from app.db.tickets import (
    create_store_call,
    update_store_call_bolna_id,
    update_store_call_status,
    get_stores,
    log_tool_call,
)
from app.services.bolna_client import create_store_phone_call

logger = logging.getLogger(__name__)

MAX_STORES = Config.MAX_STORES_TO_CALL


def _build_user_data(
    product: dict[str, Any],
    location: str,
    store: dict[str, Any],
    customer_name: str,
    region: dict[str, Any],
    ticket_id: str,
    store_call_id: int,
) -> dict[str, Any]:
    """
    Build the user_data dict to pass to Bolna.
    These values are injected into the agent's system prompt via {field} template vars.
    Keys here must match the {variable_name} placeholders in the Bolna agent prompt.
    """
    specs = product.get("specs") or {}
    specs_lines = [f"{k}: {v}" for k, v in specs.items()]
    specs_str = ", ".join(specs_lines) if specs_lines else "No specific requirements"

    alts = product.get("alternatives") or []
    alts_str = ", ".join(a["name"] for a in alts) if alts else "None"

    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    current_datetime = ist_now.strftime("%A, %d %B %Y, %I:%M %p IST")

    greeting = region.get("greeting", "Namaste ji!").replace("{customer_name}", customer_name)

    return {
        # Routing — used by webhook to match call to ticket
        "ticket_id": ticket_id,
        "store_call_id": store_call_id,

        # Store context
        "store_name": store["store_name"],

        # Product context
        "product_name": product.get("product_name", "the product"),
        "product_specs": specs_str,
        "alternatives": alts_str,
        "location": location,
        "customer_name": customer_name,

        # Regional context
        "city": region.get("display_name", "India"),
        "regional_language": region.get("regional_language", "hindi"),
        "communication_style": region.get("communication_style", "Speak in Hindi and English."),
        "greeting": greeting,
        "thank_you": region.get("thank_you", "Bahut dhanyavaad ji!"),
        "busy_response": region.get("busy_response", "Koi baat nahi ji!"),

        # Meta
        "current_datetime": current_datetime,
    }


async def call_stores(
    ticket_id: str,
    product: dict[str, Any],
    location: str,
    *,
    test_mode: bool = False,
    test_phone: str | None = None,
    max_stores: int | None = None,
    customer_name: str | None = None,
) -> list[dict[str, Any]]:
    """
    Initiate Bolna calls to stores saved for this ticket.

    In test_mode: only places ONE call to test_phone (using the first store's
    context) so you can hear the bot without calling real stores.
    """
    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    open_hour, close_hour, close_minute = 10, 22, 30  # 10:00 AM – 10:30 PM IST
    ist_time = ist_now.hour * 60 + ist_now.minute
    if ist_time < open_hour * 60 or ist_time >= close_hour * 60 + close_minute:
        logger.warning(
            "Ticket %s: skipping calls — IST time %s is outside calling window",
            ticket_id, ist_now.strftime("%I:%M %p"),
        )
        return []

    stores = get_stores(ticket_id)
    if not stores:
        logger.warning("No stores to call for ticket %s", ticket_id)
        return []

    cap = max_stores or MAX_STORES
    targets = stores[:1] if test_mode else stores[:cap]
    customer = customer_name or "a customer"

    results = []
    for store in targets:
        phone = test_phone if test_mode else store.get("phone_number")
        if not phone:
            logger.warning("Skipping store %s — no phone number", store["store_name"])
            continue

        region = detect_region(location)
        store_call_id = create_store_call(ticket_id, store["id"])
        user_data = _build_user_data(product, location, store, customer, region, ticket_id, store_call_id)

        try:
            bolna_result = await create_store_phone_call(phone, user_data)

            if bolna_result.get("success"):
                bolna_call_id = bolna_result.get("call_id")
                if bolna_call_id:
                    update_store_call_bolna_id(store_call_id, bolna_call_id)
                status = "calling"
            else:
                logger.error(
                    "Bolna call failed for store %s: %s",
                    store["store_name"], bolna_result.get("error"),
                )
                update_store_call_status(store_call_id, "failed")
                status = "failed"

            log_tool_call(
                ticket_id, "bolna_create_store_call",
                {"store": store["store_name"], "phone": phone, "test_mode": test_mode},
                bolna_result,
                status="success" if bolna_result.get("success") else "error",
                error_message=bolna_result.get("error"),
                store_call_id=store_call_id,
            )

            results.append({
                "store_id": store["id"],
                "store_name": store["store_name"],
                "store_call_id": store_call_id,
                "bolna_call_id": bolna_result.get("call_id"),
                "status": status,
            })

        except Exception as e:
            logger.exception("Failed to call store %s", store["store_name"])
            update_store_call_status(store_call_id, "failed")
            results.append({
                "store_id": store["id"],
                "store_name": store["store_name"],
                "store_call_id": store_call_id,
                "status": "failed",
            })

    return results
