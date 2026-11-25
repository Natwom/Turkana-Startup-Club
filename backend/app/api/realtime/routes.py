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
from app.models.groups import ChatGroup, ChatGroupMember
from app.services.group_calls import MAX_PARTICIPANTS, GroupCall, Participant, group_calls
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


@router.get("/api/group-calls/active")
def active_group_calls(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Live group calls in the groups this user belongs to (for the 'Join' banner)."""
    group_ids = [r[0] for r in db.query(ChatGroupMember.group_id).filter(
        ChatGroupMember.user_id == user.id).all()]
    out = []
    for gid in group_ids:
        c = group_calls.get(gid)
        if c and c.participants:
            out.append({"group_id": gid, "group_name": c.group_name,
                        "count": len(c.participants)})
    return out


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


def _group_info(group_id: str, user_id: str) -> dict | None:
    """Group name + member ids, but only if user_id is a member of the group."""
    db = SessionLocal()
    try:
        mem = db.query(ChatGroupMember).filter(
            ChatGroupMember.group_id == group_id,
            ChatGroupMember.user_id == user_id).first()
        if not mem:
            return None
        g = db.get(ChatGroup, group_id)
        if not g:
            return None
        return {"name": g.name, "members": [m.user_id for m in g.members]}
    finally:
        db.close()


def _member_ids(group_id: str) -> list[str]:
    db = SessionLocal()
    try:
        return [r[0] for r in db.query(ChatGroupMember.user_id).filter(
            ChatGroupMember.group_id == group_id).all()]
    finally:
        db.close()


def _notify_group_call(group_id: str, group_name: str, starter_id: str,
                       starter_name: str, member_ids: list[str]) -> None:
    db = SessionLocal()
    try:
        for mid in member_ids:
            if mid != starter_id:
                notify(db, mid, f'{starter_name} started a voice call in "{group_name}"',
                       ntype="call", link=f"/messages/group/{group_id}")
    finally:
        db.close()


# ------------------------------------------------------------ 1:1 call helpers
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


# ------------------------------------------------------------ group call helpers
async def _safe_send(ws, payload: dict) -> None:
    try:
        await ws.send_json(payload)
    except Exception:
        pass   # that socket is closing; its own cleanup will remove the participant


async def _gcall_announce(call: GroupCall, member_ids: list[str] | None = None,
                          new: bool = False) -> None:
    """Tell every member of the group (online) whether a call is live and how many are in it."""
    if member_ids is None:
        member_ids = await run_in_threadpool(_member_ids, call.group_id)
    active = bool(call.participants)
    count = len(call.participants)
    for mid in member_ids:
        await presence.send_to_user(mid, {
            "type": "gcall_status",
            "group_id": call.group_id,
            "group_name": call.group_name,
            "active": active,
            "count": count,
            "new": bool(new and mid != call.started_by_id),   # drives the "Join" pop-up
            "started_by": call.started_by_name,
        })


async def _gcall_state(call: GroupCall, who: Participant) -> None:
    """Mute / raised-hand changed: tell the other people in the call."""
    for p in list(call.participants.values()):
        if p.user_id != who.user_id:
            await _safe_send(p.ws, {"type": "gcall_peer_state", "group_id": call.group_id,
                                    "user": who.public()})


async def _gcall_remove(call: GroupCall, uid: str) -> None:
    if call.participants.pop(uid, None) is None:
        return
    for p in list(call.participants.values()):
        await _safe_send(p.ws, {"type": "gcall_peer_left", "group_id": call.group_id,
                                "user_id": uid})
    if not call.participants:
        group_calls.remove(call)
    await _gcall_announce(call)


async def _gcall_join(me: dict, ws: WebSocket, gid: str) -> None:
    uid = me["id"]
    info = await run_in_threadpool(_group_info, gid, uid)
    if not info:
        await _safe_send(ws, {"type": "gcall_error", "group_id": gid, "reason": "not_allowed"})
        return

    # No awaits between the checks below and adding the participant, so two people
    # joining at the same moment can never both think they are first.
    if calls.for_user(uid) or group_calls.for_user(uid):
        await _safe_send(ws, {"type": "gcall_error", "group_id": gid, "reason": "busy_self"})
        return
    call = group_calls.get(gid)
    if call and len(call.participants) >= MAX_PARTICIPANTS:
        await _safe_send(ws, {"type": "gcall_error", "group_id": gid, "reason": "full"})
        return
    is_new = call is None
    if is_new:
        call = group_calls.create(gid, info["name"], uid, me["name"])
    existing = [p.public() for p in call.participants.values()]
    mine = Participant(user_id=uid, name=me["name"], ws=ws)
    call.participants[uid] = mine

    # The newcomer sends an offer to each person already in the call.
    await _safe_send(ws, {"type": "gcall_joined", "group_id": gid, "participants": existing})
    for p in list(call.participants.values()):
        if p.user_id != uid:
            await _safe_send(p.ws, {"type": "gcall_peer_joined", "group_id": gid,
                                    "user": mine.public()})
    await _gcall_announce(call, info["members"], new=is_new)
    if is_new:
        await run_in_threadpool(_notify_group_call, gid, info["name"], uid,
                                me["name"], info["members"])


async def _handle_group_call(me: dict, ws: WebSocket, msg: dict) -> None:
    uid = me["id"]
    t = msg.get("type")
    gid = str(msg.get("group_id", ""))

    if t == "gcall_join":
        await _gcall_join(me, ws, gid)
        return

    # everything else needs the sender to be in that call, on this same connection
    call = group_calls.get(gid)
    mine = call.participants.get(uid) if call else None
    if not call or not mine or mine.ws is not ws:
        return

    if t == "gcall_leave":
        await _gcall_remove(call, uid)

    elif t == "gcall_signal":
        to = str(msg.get("to", ""))
        data = msg.get("data")
        target = call.participants.get(to)
        if target and to != uid and isinstance(data, dict) and len(json.dumps(data)) < 20000:
            await _safe_send(target.ws, {"type": "gcall_signal", "group_id": gid,
                                         "from": uid, "data": data})

    elif t == "gcall_mute":
        mine.muted = bool(msg.get("muted"))
        await _gcall_state(call, mine)

    elif t == "gcall_hand":
        raised = bool(msg.get("raised"))
        if raised and mine.hand_at is None:
            mine.hand_at = time.time()
        elif not raised:
            mine.hand_at = None
        await _gcall_state(call, mine)


# ------------------------------------------------------------ message router
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

    if isinstance(t, str) and t.startswith("gcall_"):
        await _handle_group_call(me, ws, msg)
        return

    if t == "call_invite":
        to = str(msg.get("to", ""))
        kind = "video" if msg.get("kind") == "video" else "audio"
        if to == uid or not await run_in_threadpool(_can_call, uid, to):
            await ws.send_json({"type": "call_failed", "reason": "not_allowed"})
            return
        if calls.for_user(uid) or group_calls.for_user(uid):
            await ws.send_json({"type": "call_failed", "reason": "busy_self"})
            return
        if not presence.is_online(to):
            await ws.send_json({"type": "call_failed", "reason": "offline"})
            await run_in_threadpool(_missed_call, to, uid, me["name"], kind)
            return
        if calls.for_user(to) or group_calls.for_user(to):
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

    # a closed connection leaves any group call it was in
    gcall = group_calls.for_ws(ws)
    if gcall:
        await _gcall_remove(gcall, uid)

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