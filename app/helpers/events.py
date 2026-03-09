"""Lightweight in-process pub/sub for ticket state changes.

Used to drive Server-Sent Events (SSE) streams so the frontend
can react to changes instantly instead of polling.
"""

import asyncio
from collections import defaultdict


class TicketEvents:
    _listeners: dict[str, list[asyncio.Event]] = defaultdict(list)

    @classmethod
    def subscribe(cls, ticket_id: str) -> asyncio.Event:
        event = asyncio.Event()
        cls._listeners[ticket_id].append(event)
        return event

    @classmethod
    def unsubscribe(cls, ticket_id: str, event: asyncio.Event) -> None:
        listeners = cls._listeners.get(ticket_id, [])
        try:
            listeners.remove(event)
        except ValueError:
            pass
        if not listeners and ticket_id in cls._listeners:
            del cls._listeners[ticket_id]

    @classmethod
    def notify(cls, ticket_id: str) -> None:
        for event in cls._listeners.get(ticket_id, []):
            event.set()
