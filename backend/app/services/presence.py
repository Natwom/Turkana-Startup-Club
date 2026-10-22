"""In-memory registry of live WebSocket connections and active calls.

Works for a single backend process (run one instance on Render).
"""
import asyncio
import uuid
from typing import Optional

from fastapi import WebSocket


class PresenceManager:
    def __init__(self) -> None:
        self._sockets: dict[str, set[WebSocket]] = {}

    def is_online(self, user_id: str) -> bool:
        return bool(self._sockets.get(user_id))

    def online_ids(self) -> list[str]:
        return [uid for uid, socks in self._sockets.items() if socks]

    def add(self, user_id: str, ws: WebSocket) -> bool:
        """Register a socket. True if this is the user's first one (they just came online)."""
        first = not self._sockets.get(user_id)
        self._sockets.setdefault(user_id, set()).add(ws)
        return first

    def remove(self, user_id: str, ws: WebSocket) -> bool:
        """Unregister a socket. True if it was the user's last one (they just went offline)."""
        socks = self._sockets.get(user_id)
        if socks is None:
            return False
        socks.discard(ws)
        if socks:
            return False
        del self._sockets[user_id]
        return True

    async def send_to_user(self, user_id: str, payload: dict,
                           skip: Optional[WebSocket] = None) -> bool:
        delivered = False
        for ws in list(self._sockets.get(user_id, ())):
            if ws is skip:
                continue
            try:
                await ws.send_json(payload)
                delivered = True
            except Exception:
                pass
        return delivered

    async def broadcast(self, payload: dict, exclude: Optional[str] = None) -> None:
        for uid in list(self._sockets):
            if uid != exclude:
                await self.send_to_user(uid, payload)


class Call:
    def __init__(self, caller_id: str, callee_id: str, kind: str) -> None:
        self.call_id = uuid.uuid4().hex
        self.caller_id = caller_id
        self.callee_id = callee_id
        self.kind = kind                 # "audio" | "video"
        self.state = "ringing"           # "ringing" | "active"
        self.timer: Optional[asyncio.Task] = None

    def other(self, user_id: str) -> str:
        return self.callee_id if user_id == self.caller_id else self.caller_id

    def cancel_timer(self) -> None:
        if self.timer and not self.timer.done():
            self.timer.cancel()


class CallRegistry:
    def __init__(self) -> None:
        self._calls: dict[str, Call] = {}
        self._by_user: dict[str, str] = {}

    def create(self, caller_id: str, callee_id: str, kind: str) -> Call:
        call = Call(caller_id, callee_id, kind)
        self._calls[call.call_id] = call
        self._by_user[caller_id] = call.call_id
        self._by_user[callee_id] = call.call_id
        return call

    def get(self, call_id: str) -> Optional[Call]:
        return self._calls.get(call_id)

    def for_user(self, user_id: str) -> Optional[Call]:
        cid = self._by_user.get(user_id)
        return self._calls.get(cid) if cid else None

    def remove(self, call: Call) -> None:
        self._calls.pop(call.call_id, None)
        for uid in (call.caller_id, call.callee_id):
            if self._by_user.get(uid) == call.call_id:
                del self._by_user[uid]


presence = PresenceManager()
calls = CallRegistry()