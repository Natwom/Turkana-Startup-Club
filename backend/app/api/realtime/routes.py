import asyncio
import json
import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import decode_token
from app.db.session import SessionLocal, get_db
from app.models import Connection, User
from app.services.notifications import notify
from app.services.presence import Call, calls, presence

router = APIRouter(tags=["realtime"])

RING_SECONDS = 45
_last_write: dict[str, float] = {}   # throttle for last_seen writes while connected


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None   # stored as naive UTC


# ------------------------------------------------------------ REST endpoints
@router.get("/api/presence")
def get_presence(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """{ user_id: { online, last_seen } } for every active member."""
    online = set(presence.online_ids())
    rows = db.query(User.id, User.last_seen).filter(
        User.is_suspended == False).all()  # noqa: E712
    return {uid: {"online": uid in online, "last_seen": _iso(seen)} for uid, seen in rows}


@router.get("/api/calls/ice")
def ice_servers(user: User = Depends(get_current_user)):
    servers = [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}]
    urls = [u.strip() for u in settings.TURN_URLS.split(",") if u.strip()]
    if urls and settings.TURN_USERNAME and settings.TURN_CREDENTIAL:
        servers.append({"urls": urls,
                        "username": settings.TURN_USERNAME,
                        "credential": settings.TURN_CREDENTIAL})
    return {"iceServers": servers}


# ------------------------------------------------------------ sync DB helpers
# (run in a thread pool so they never block the WebSocket event loop)
def _auth_user(token: str) -> dict | None:
    try:
        payload = decode_token(token, "access")
    except HTTPException:
        return None
    db = SessionLocal()
    try:
        u = db.get(User, payload.get("sub"))
        if not u or u.is_suspended:
            return None
        return {"id": u.id, "name": u.full_name}
    finally:
        db.close()


def _touch(user_id: str) -> datetime:
    now = datetime.utcnow()
    db = SessionLocal()
    try:
        db.query(User).filter(User.id == user_id).update({User.last_seen: now})
        db.commit()
    finally:
        db.close()
    return now


def _can_call(caller_id: str, callee_id: str) -> bool:
    """Same rule as messaging: only accepted connections can reach each other."""
    db = SessionLocal()
    try:
        callee = db.get(User, callee_id)
        if not callee or callee.is_suspended:
            return False
        return db.query(Connection).filter(
            Connection.status == "accepted",
            or_(
                and_(Connection.requester_id == caller_id, Connection.addressee_id == callee_id),
                and_(Connection.requester_id == callee_id, Connection.addressee_id == caller_id),
            ),
        ).first() is not None
    finally:
        db.close()


def _missed_call(callee_id: str, caller_id: str, caller_name: str, kind: str) -> None:
    db = SessionLocal()
    try:
        notify(db, callee_id, f"Missed {kind} call from {caller_name}",
               ntype="call", link=f"/messages/{caller_id}")
    finally:
        db.close()


# ------------------------------------------------------------ call helpers
async def _ring_timeout(call: Call, caller_name: str) -> None:
    try:
        await asyncio.sleep(RING_SECONDS)
    except asyncio.CancelledError:
        return
    if calls.get(call.call_id) is not call or call.state != "ringing":
        return
    calls.remove(call)
    await presence.send_to_user(call.caller_id, {"type": "call_unanswered", "call_id": call.call_id})
    await presence.send_to_user(call.callee_id, {"type": "call_cancelled", "call_id": call.call_id})
    await run_in_threadpool(_missed_call, call.callee_id, call.caller_id, caller_name, call.kind)


async def _handle(me: dict, ws: WebSocket, msg: dict) -> None:
    uid = me["id"]
    t = msg.get("type")

    if t == "ping":
        await ws.send_json({"type": "pong"})
        now = time.monotonic()
        if now - _last_write.get(uid, 0) > 60:
            _last_write[uid] = now
            await run_in_threadpool(_touch, uid)
        return

    if t == "call_invite":
        to = str(msg.get("to", ""))
        kind = "video" if msg.get("kind") == "video" else "audio"
        if to == uid or not await run_in_threadpool(_can_call, uid, to):
            await ws.send_json({"type": "call_failed", "reason": "not_allowed"})
            return
        if calls.for_user(uid):
            await ws.send_json({"type": "call_failed", "reason": "busy_self"})
            return
        if not presence.is_online(to):
            await ws.send_json({"type": "call_failed", "reason": "offline"})
            await run_in_threadpool(_missed_call, to, uid, me["name"], kind)
            return
        if calls.for_user(to):
            await ws.send_json({"type": "call_failed", "reason": "busy"})
            return
        call = calls.create(uid, to, kind)
        await ws.send_json({"type": "call_ringing", "call_id": call.call_id})
        await presence.send_to_user(to, {
            "type": "call_incoming", "call_id": call.call_id,
            "from": uid, "from_name": me["name"], "kind": kind,
        })
        call.timer = asyncio.create_task(_ring_timeout(call, me["name"]))
        return

    # everything below needs an existing call that this user belongs to
    call = calls.get(str(msg.get("call_id", "")))
    if not call or uid not in (call.caller_id, call.callee_id):
        return
    cid = call.call_id

    if t == "signal":
        data = msg.get("data")
        if call.state == "active" and isinstance(data, dict):
            await presence.send_to_user(call.other(uid),
                                        {"type": "signal", "call_id": cid, "data": data})

    elif t == "call_accept" and uid == call.callee_id and call.state == "ringing":
        call.cancel_timer()
        call.state = "active"
        await presence.send_to_user(call.caller_id, {"type": "call_accepted", "call_id": cid})
        # stop ringing on the callee's other devices
        await presence.send_to_user(uid, {"type": "call_handled", "call_id": cid}, skip=ws)

    elif t == "call_decline" and uid == call.callee_id and call.state == "ringing":
        call.cancel_timer()
        calls.remove(call)
        await presence.send_to_user(call.caller_id, {"type": "call_declined", "call_id": cid})
        await presence.send_to_user(uid, {"type": "call_handled", "call_id": cid}, skip=ws)

    elif t == "call_cancel" and uid == call.caller_id and call.state == "ringing":
        call.cancel_timer()
        calls.remove(call)
        await presence.send_to_user(call.callee_id, {"type": "call_cancelled", "call_id": cid})
        await run_in_threadpool(_missed_call, call.callee_id, uid, me["name"], call.kind)

    elif t == "call_end":
        call.cancel_timer()
        calls.remove(call)
        await presence.send_to_user(call.other(uid), {"type": "call_ended", "call_id": cid})


async def _cleanup(me: dict, ws: WebSocket) -> None:
    uid = me["id"]
    went_offline = presence.remove(uid, ws)
    if not went_offline:
        return
    _last_write.pop(uid, None)

    # end any call this user was part of
    call = calls.for_user(uid)
    if call:
        call.cancel_timer()
        calls.remove(call)
        other = call.other(uid)
        if call.state == "active":
            await presence.send_to_user(other, {"type": "call_ended", "call_id": call.call_id})
        elif uid == call.caller_id:
            await presence.send_to_user(other, {"type": "call_cancelled", "call_id": call.call_id})
            await run_in_threadpool(_missed_call, other, uid, me["name"], call.kind)
        else:
            await presence.send_to_user(other, {"type": "call_declined", "call_id": call.call_id})

    seen = await run_in_threadpool(_touch, uid)
    await presence.broadcast(
        {"type": "presence", "user_id": uid, "online": False, "last_seen": _iso(seen)})


# ------------------------------------------------------------ the WebSocket
@router.websocket("/api/ws")
async def realtime(ws: WebSocket):
    await ws.accept()

    # The token is sent in the first message (not the URL), so it never lands in server logs.
    try:
        first = json.loads(await asyncio.wait_for(ws.receive_text(), timeout=10))
    except Exception:
        await ws.close(code=4400)
        return

    me = None
    if isinstance(first, dict) and first.get("type") == "auth":
        me = await run_in_threadpool(_auth_user, str(first.get("token", "")))
    if not me:
        await ws.send_json({"type": "auth_error"})
        await ws.close(code=4401)
        return

    uid = me["id"]
    went_online = presence.add(uid, ws)
    _last_write[uid] = time.monotonic()
    await run_in_threadpool(_touch, uid)
    await ws.send_json({"type": "ready"})
    if went_online:
        await presence.broadcast(
            {"type": "presence", "user_id": uid, "online": True, "last_seen": None}, exclude=uid)

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except ValueError:
                continue
            if isinstance(msg, dict):
                await _handle(me, ws, msg)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await _cleanup(me, ws)