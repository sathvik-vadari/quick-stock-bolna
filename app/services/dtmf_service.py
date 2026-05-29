"""DTMF Service — sends DTMF tones during live calls via the telephony provider.

Plivo is recommended: its play_dtmf API injects tones without disrupting the
real-time audio pipeline. Twilio support is best-effort only — updating a live
call's TwiML may momentarily interrupt Bolna's bidirectional audio stream.
"""
import logging
from typing import Any
from base64 import b64encode

import aiohttp

from app.helpers.config import Config
from app.helpers.http_session import get_session

logger = logging.getLogger(__name__)


async def send_dtmf(call_sid: str, digits: str) -> dict[str, Any]:
    """
    Send DTMF tones on a live call identified by call_sid.

    Args:
        call_sid: The telephony provider's call identifier (Plivo call_uuid
                  or Twilio CallSid), available in Bolna as {call_sid}.
        digits:   Digits to send (0-9, *, #). E.g. "1", "0", "1234".

    Returns:
        {"success": True} or {"success": False, "error": "..."}
    """
    allowed = set("0123456789*#wW")
    if not digits or not all(ch in allowed for ch in digits):
        return {"success": False, "error": f"Invalid DTMF digits: {digits!r}"}

    provider = Config.TELEPHONY_PROVIDER.lower()
    if provider == "plivo":
        return await _send_dtmf_plivo(call_sid, digits)
    elif provider == "twilio":
        return await _send_dtmf_twilio(call_sid, digits)
    else:
        return {"success": False, "error": f"Unsupported telephony provider: {provider}"}


async def _send_dtmf_plivo(call_uuid: str, digits: str) -> dict[str, Any]:
    """Send DTMF via Plivo's play_dtmf API (non-disruptive)."""
    auth_id = Config.PLIVO_AUTH_ID
    auth_token = Config.PLIVO_AUTH_TOKEN
    if not auth_id or not auth_token:
        return {"success": False, "error": "PLIVO_AUTH_ID / PLIVO_AUTH_TOKEN not configured"}

    url = f"https://api.plivo.com/v1/Account/{auth_id}/Call/{call_uuid}/DTMF/"
    creds = b64encode(f"{auth_id}:{auth_token}".encode()).decode()
    headers = {
        "Authorization": f"Basic {creds}",
        "Content-Type": "application/json",
    }
    payload = {"digits": digits, "leg": "aleg"}

    try:
        session = await get_session()
        async with session.post(url, headers=headers, json=payload) as resp:
            body = await resp.text()
            if resp.status in (200, 202, 204):
                logger.info("Plivo DTMF sent: call=%s digits=%s", call_uuid, digits)
                return {"success": True, "message": f"Sent DTMF '{digits}'"}
            logger.error("Plivo DTMF failed: %s %s", resp.status, body)
            return {"success": False, "error": f"Plivo returned {resp.status}: {body}"}
    except Exception as e:
        logger.exception("Plivo DTMF request failed")
        return {"success": False, "error": str(e)}


async def _send_dtmf_twilio(call_sid: str, digits: str) -> dict[str, Any]:
    """
    Send DTMF via Twilio by updating the call with <Play digits> TwiML.

    WARNING: This briefly redirects the call, which may disrupt Bolna's
    real-time audio pipeline. Plivo is the recommended provider for DTMF.
    """
    account_sid = Config.TWILIO_ACCOUNT_SID
    auth_token = Config.TWILIO_AUTH_TOKEN
    if not account_sid or not auth_token:
        return {"success": False, "error": "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured"}

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls/{call_sid}.json"
    creds = b64encode(f"{account_sid}:{auth_token}".encode()).decode()
    headers = {"Authorization": f"Basic {creds}"}

    twiml = f'<Response><Play digits="{digits}"/><Pause length="60"/></Response>'
    form_data = aiohttp.FormData()
    form_data.add_field("Twiml", twiml)

    try:
        session = await get_session()
        async with session.post(url, headers=headers, data=form_data) as resp:
            body = await resp.text()
            if resp.status in (200, 201):
                logger.info("Twilio DTMF sent: call=%s digits=%s", call_sid, digits)
                return {
                    "success": True,
                    "message": f"Sent DTMF '{digits}'",
                    "warning": "Twilio TwiML redirect may briefly interrupt audio",
                }
            logger.error("Twilio DTMF failed: %s %s", resp.status, body)
            return {"success": False, "error": f"Twilio returned {resp.status}: {body}"}
    except Exception as e:
        logger.exception("Twilio DTMF request failed")
        return {"success": False, "error": str(e)}
