"""Bolna API client — initiates outbound store inquiry calls."""
import logging
from typing import Any

import aiohttp

from app.helpers.config import Config

logger = logging.getLogger(__name__)

BOLNA_CALL_URL = "https://api.bolna.dev/call"


async def create_store_phone_call(
    recipient_phone: str,
    user_data: dict[str, Any],
) -> dict[str, Any]:
    """
    Initiate an outbound call via Bolna to a store.

    The Bolna agent is pre-configured on app.bolna.dev with a system prompt
    that uses {{user_data.variable}} template variables. All dynamic context
    (product name, store name, specs, etc.) is injected here via user_data.

    Args:
        recipient_phone: E.164 phone number of the store (e.g. "+919876543210")
        user_data: Dict with product details, store context, and routing IDs
                   (ticket_id, store_call_id) for webhook routing.

    Returns:
        {"success": True, "call_id": "..."} or {"success": False, "error": "..."}
    """
    api_key = Config.BOLNA_API_KEY
    agent_id = Config.BOLNA_AGENT_ID

    if not api_key:
        return {"success": False, "error": "BOLNA_API_KEY not configured"}
    if not agent_id:
        return {"success": False, "error": "BOLNA_AGENT_ID not configured"}

    payload = {
        "agent_id": agent_id,
        "recipient_phone_number": recipient_phone,
        "user_data": user_data,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(BOLNA_CALL_URL, headers=headers, json=payload) as resp:
                if resp.status in (200, 201):
                    data = await resp.json()
                    call_id = (
                        data.get("call_id")
                        or data.get("conversation_id")
                        or data.get("id")
                    )
                    logger.info(
                        "Bolna call created: phone=%s call_id=%s",
                        recipient_phone, call_id,
                    )
                    return {"success": True, "call_id": call_id, "response": data}
                text = await resp.text()
                logger.error("Bolna call failed: %s %s", resp.status, text)
                return {"success": False, "error": f"Bolna returned {resp.status}", "body": text}
    except Exception as e:
        logger.exception("Bolna API call raised an exception")
        return {"success": False, "error": str(e)}
