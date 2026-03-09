"""Bolna API client — initiates outbound store inquiry calls."""
import logging
from typing import Any

import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.helpers.config import Config
from app.helpers.http_session import get_session

logger = logging.getLogger(__name__)

BOLNA_CALL_URL = "https://api.bolna.dev/call"


async def create_store_phone_call(
    recipient_phone: str,
    user_data: dict[str, Any],
) -> dict[str, Any]:
    """
    Initiate an outbound call via Bolna to a store.

    The Bolna agent is pre-configured on app.bolna.dev with a system prompt
    that uses {variable_name} template variables. Bolna substitutes these with
    matching keys from the user_data dict sent in the API call.

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
        data = await _post_bolna(headers, payload)
        call_id = (
            data.get("execution_id")
            or data.get("call_id")
            or data.get("conversation_id")
            or data.get("id")
        )
        logger.info(
            "Bolna call created: phone=%s call_id=%s raw_response=%s",
            recipient_phone, call_id, data,
        )
        return {"success": True, "call_id": call_id, "response": data}
    except _BolnaHTTPError as e:
        logger.error("Bolna call failed: %s", e)
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.exception("Bolna API call raised an exception")
        return {"success": False, "error": str(e)}


class _BolnaHTTPError(Exception):
    pass


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((TimeoutError, aiohttp.ClientError, OSError)),
    reraise=True,
)
async def _post_bolna(headers: dict, payload: dict) -> dict:
    session = await get_session()
    async with session.post(BOLNA_CALL_URL, headers=headers, json=payload) as resp:
        if resp.status in (200, 201):
            return await resp.json()
        text = await resp.text()
        raise _BolnaHTTPError(f"Bolna returned {resp.status}: {text}")
