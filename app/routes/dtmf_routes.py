"""DTMF route — called by Bolna's custom function tool to send keypad tones."""
import logging

from fastapi import APIRouter, Request, Response

from app.helpers.config import Config
from app.services.dtmf_service import send_dtmf
from app.db.tickets import log_tool_call

logger = logging.getLogger(__name__)

router = APIRouter(tags=["dtmf"])


@router.post("/api/dtmf/send")
async def dtmf_send(request: Request) -> dict:
    """
    Send DTMF tones on an active call.

    Called by the Bolna agent's send_dtmf custom function tool during a live
    call when the bot encounters an IVR menu.

    Bolna sends:
        {
            "digits": "1",
            "call_sid": "call-uuid-from-provider"
        }
    """
    token = Config.DTMF_API_TOKEN
    if token:
        auth = request.headers.get("Authorization", "")
        expected = f"Bearer {token}"
        if auth != expected:
            logger.warning("DTMF endpoint: unauthorized request")
            return {"success": False, "error": "Unauthorized"}

    try:
        body = await request.json()
    except Exception:
        return {"success": False, "error": "Invalid JSON body"}

    digits = body.get("digits", "")
    call_sid = body.get("call_sid", "")

    if not digits:
        return {"success": False, "error": "Missing 'digits' parameter"}
    if not call_sid:
        return {"success": False, "error": "Missing 'call_sid' — ensure {call_sid} is in the Bolna agent prompt"}

    logger.info("DTMF request: call_sid=%s digits=%s", call_sid, digits)

    result = await send_dtmf(call_sid, digits)

    log_tool_call(
        ticket_id="dtmf",
        tool_name="send_dtmf",
        input_params={"call_sid": call_sid, "digits": digits},
        output_result=result,
        status="success" if result.get("success") else "error",
        error_message=result.get("error"),
    )

    return result
