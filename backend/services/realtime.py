import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Set, Any
from fastapi import WebSocket


class RealtimeSessionHub:
    """
    Manages WebSocket and SSE subscriptions per session_id so every state mutation
    is pushed to connected verification officers immediately without polling.
    """

    def __init__(self):
        self._ws_connections: Dict[str, Set[WebSocket]] = {}
        self._sse_queues: Dict[str, Set[asyncio.Queue]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect_ws(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._loop = asyncio.get_running_loop()
        self._ws_connections.setdefault(session_id, set()).add(websocket)

    def disconnect_ws(self, session_id: str, websocket: WebSocket) -> None:
        conns = self._ws_connections.get(session_id)
        if conns:
            conns.discard(websocket)
            if not conns:
                self._ws_connections.pop(session_id, None)

    def subscribe_sse(self, session_id: str) -> asyncio.Queue:
        try:
            self._loop = asyncio.get_running_loop()
        except RuntimeError:
            pass
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._sse_queues.setdefault(session_id, set()).add(q)
        return q

    def unsubscribe_sse(self, session_id: str, queue: asyncio.Queue) -> None:
        qs = self._sse_queues.get(session_id)
        if qs:
            qs.discard(queue)
            if not qs:
                self._sse_queues.pop(session_id, None)

    async def broadcast(self, session_id: str, event_type: str, data: Dict[str, Any]) -> None:
        if not session_id:
            return
        payload = {
            "type": event_type,
            "event": event_type,
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        message_text = json.dumps(payload, default=str)

        stale_ws = []
        for ws in list(self._ws_connections.get(session_id, set())):
            try:
                await ws.send_text(message_text)
            except Exception:
                stale_ws.append(ws)
        for ws in stale_ws:
            self.disconnect_ws(session_id, ws)

        for q in list(self._sse_queues.get(session_id, set())):
            try:
                if q.full():
                    try:
                        q.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                q.put_nowait(message_text)
            except Exception:
                pass

    def broadcast_sync(self, session_id: str, event_type: str, data: Dict[str, Any]) -> None:
        """Thread-safe bridge allowing synchronous REST handlers/DB methods to emit events."""
        try:
            running = asyncio.get_running_loop()
            running.create_task(self.broadcast(session_id, event_type, data))
            return
        except RuntimeError:
            pass

        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast(session_id, event_type, data), self._loop)


realtime_hub = RealtimeSessionHub()

