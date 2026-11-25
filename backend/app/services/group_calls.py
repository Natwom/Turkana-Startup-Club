"""In-memory state for live group voice calls.

Lives in one process, the same assumption presence.py already makes.
Audio uses a WebRTC mesh: every person connects directly to every other person,
so the room is capped at MAX_PARTICIPANTS.
"""
import time
from dataclasses import dataclass, field

MAX_PARTICIPANTS = 6


@dataclass
class Participant:
    user_id: str
    name: str
    ws: object                      # the exact WebSocket that joined (one device per call)
    muted: bool = False
    hand_at: float | None = None    # when the hand was raised; None = hand down

    def public(self) -> dict:
        return {
            "user_id": self.user_id,
            "name": self.name,
            "muted": self.muted,
            "hand": self.hand_at is not None,
            "hand_at": self.hand_at,
        }


@dataclass
class GroupCall:
    group_id: str
    group_name: str
    started_by_id: str
    started_by_name: str
    started_at: float = field(default_factory=time.time)
    participants: dict[str, Participant] = field(default_factory=dict)


class GroupCalls:
    def __init__(self) -> None:
        self._calls: dict[str, GroupCall] = {}

    def get(self, group_id: str) -> GroupCall | None:
        return self._calls.get(group_id)

    def create(self, group_id: str, group_name: str,
               started_by_id: str, started_by_name: str) -> GroupCall:
        call = GroupCall(group_id, group_name, started_by_id, started_by_name)
        self._calls[group_id] = call
        return call

    def remove(self, call: GroupCall) -> None:
        if self._calls.get(call.group_id) is call:
            del self._calls[call.group_id]

    def for_user(self, user_id: str) -> GroupCall | None:
        for call in self._calls.values():
            if user_id in call.participants:
                return call
        return None

    def for_ws(self, ws: object) -> GroupCall | None:
        for call in self._calls.values():
            if any(p.ws is ws for p in call.participants.values()):
                return call
        return None


group_calls = GroupCalls()