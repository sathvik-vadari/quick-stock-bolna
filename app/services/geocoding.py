"""Google Maps Geocoding — forward geocode for proximity bias in store search."""
import logging
import re
from typing import Any, Optional

import aiohttp

from app.helpers.config import Config

logger = logging.getLogger(__name__)

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

_INDIA_PINCODE_RE = re.compile(r"\b[1-9]\d{5}\b")


def extract_pincode(address: str) -> Optional[str]:
    match = _INDIA_PINCODE_RE.search(address or "")
    return match.group(0) if match else None


def _parse_address_components(components: list[dict]) -> dict[str, str]:
    result: dict[str, str] = {}
    for comp in components:
        types = comp.get("types", [])
        if "postal_code" in types:
            result["pincode"] = comp["long_name"]
        elif "locality" in types:
            result["city"] = comp["long_name"]
        elif "administrative_area_level_1" in types:
            result["state"] = comp["long_name"]
        elif "sublocality_level_1" in types:
            result.setdefault("area", comp["long_name"])
    return result


async def geocode_address(address: str) -> Optional[dict[str, Any]]:
    if not Config.GOOGLE_MAPS_API_KEY:
        logger.error("GOOGLE_MAPS_API_KEY not set — cannot geocode")
        return None

    params = {"address": address, "key": Config.GOOGLE_MAPS_API_KEY, "region": "in"}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(GEOCODE_URL, params=params) as resp:
                data = await resp.json()
    except Exception:
        logger.exception("Geocoding request failed for %r", address)
        return None

    results = data.get("results", [])
    if not results:
        return None

    top = results[0]
    loc = top.get("geometry", {}).get("location", {})
    parsed = _parse_address_components(top.get("address_components", []))
    return {
        "lat": loc.get("lat"),
        "lng": loc.get("lng"),
        "pincode": parsed.get("pincode") or extract_pincode(top.get("formatted_address", "")),
        "city": parsed.get("city"),
        "state": parsed.get("state"),
        "formatted_address": top.get("formatted_address"),
    }
