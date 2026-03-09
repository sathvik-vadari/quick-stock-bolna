"""Shared aiohttp session — created once, reused across the app lifetime."""
import aiohttp

_session: aiohttp.ClientSession | None = None

DEFAULT_TIMEOUT = aiohttp.ClientTimeout(total=30, connect=10)


async def get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession(timeout=DEFAULT_TIMEOUT)
    return _session


async def close_session() -> None:
    global _session
    if _session and not _session.closed:
        await _session.close()
        _session = None
