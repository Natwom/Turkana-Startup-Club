from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Connection, User
from app.models.groups import ChatGroup, ChatGroupMember, ChatGroupMessage
from app.services.notifications import notify

router = APIRouter(prefix="/api/groups", tags=["groups"])

MAX_MEMBERS = 100


# ---------------------------------------------------------------- schemas
def _clean(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("This field cannot be empty")
    return v


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=300)
    member_ids: list[str] = []

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        return _clean(v)


class GroupUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=300)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        return _clean(v)


class MembersAdd(BaseModel):
    user_ids: list[str] = Field(min_length=1)


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def not_blank(cls, v: str) -> str:
        return _clean(v)


# ---------------------------------------------------------------- helpers
def _iso(dt: datetime) -> str:
    return dt.isoformat() + "Z"  # stored as naive UTC


def _connected_ids(db: Session, me_id: str) -> set[str]:
    rows = db.query(Connection).filter(
        Connection.status == "accepted",
        or_(Connection.requester_id == me_id, Connection.addressee_id == me_id),
    ).all()
    return {c.addressee_id if c.requester_id == me_id else c.requester_id for c in rows}


def _valid_connection_ids(db: Session, me: User, ids) -> set[str]:
    """Only the caller's accepted, non-suspended connections may be added to a group."""
    ids = set(ids) - {me.id}
    if not ids:
        return set()
    if not ids <= _connected_ids(db, me.id):
        raise HTTPException(400, "You can only add members you are connected with")
    active = db.query(User.id).filter(
        User.id.in_(ids), User.is_suspended == False).all()  # noqa: E712
    return {u.id for u in active}


def _membership(db: Session, group_id: str, user_id: str):
    return db.query(ChatGroupMember).filter(
        ChatGroupMember.group_id == group_id,
        ChatGroupMember.user_id == user_id).first()


def _require_member(db: Session, group_id: str, user_id: str) -> ChatGroupMember:
    m = _membership(db, group_id, user_id)
    if not m:
        raise HTTPException(404, "Group not found")  # 404 so non-members cannot probe ids
    return m


def _require_admin(db: Session, group_id: str, user_id: str) -> ChatGroupMember:
    m = _require_member(db, group_id, user_id)
    if m.role != "admin":
        raise HTTPException(403, "Only group admins can do this")
    return m


def _unread(db: Session, mem: ChatGroupMember) -> int:
    since = mem.last_read_at or mem.joined_at
    return db.query(ChatGroupMessage).filter(
        ChatGroupMessage.group_id == mem.group_id,
        ChatGroupMessage.sender_id != mem.user_id,
        ChatGroupMessage.created_at > since).count()


def _msg(m: ChatGroupMessage) -> dict:
    return {
        "id": m.id,
        "sender_id": m.sender_id,
        "sender_name": m.sender.full_name if m.sender else "Former member",
        "sender_badge": bool(m.sender and m.sender.is_badge_verified),
        "content": m.content,
        "created_at": _iso(m.created_at),
    }


def _summary(db: Session, g: ChatGroup, mem: ChatGroupMember) -> dict:
    last = db.query(ChatGroupMessage).filter(
        ChatGroupMessage.group_id == g.id
    ).order_by(ChatGroupMessage.created_at.desc()).first()
    return {
        "id": g.id,
        "name": g.name,
        "description": g.description or "",
        "member_count": len(g.members),
        "my_role": mem.role,
        "created_at": _iso(g.created_at),
        "last_message": last.content if last else "",
        "last_sender": (last.sender.full_name if last.sender else "Former member") if last else "",
        "last_message_at": _iso(last.created_at) if last else None,
        "last_from_me": bool(last and last.sender_id == mem.user_id),
        "unread": _unread(db, mem),
    }


# ---------------------------------------------------------------- endpoints
# Fixed paths first, "/{group_id}" routes after.
@router.get("")
def my_groups(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    mems = db.query(ChatGroupMember).filter(ChatGroupMember.user_id == user.id).all()
    out = [_summary(db, m.group, m) for m in mems]
    out.sort(key=lambda g: g["last_message_at"] or g["created_at"], reverse=True)
    return out


@router.post("")
def create_group(data: GroupCreate, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    member_ids = _valid_connection_ids(db, user, data.member_ids)
    if len(member_ids) + 1 > MAX_MEMBERS:
        raise HTTPException(400, f"A group can have at most {MAX_MEMBERS} members")

    group = ChatGroup(name=data.name, description=data.description.strip(), created_by=user.id)
    db.add(group)
    db.flush()

    mine = ChatGroupMember(group_id=group.id, user_id=user.id, role="admin")
    db.add(mine)
    for uid_ in member_ids:
        db.add(ChatGroupMember(group_id=group.id, user_id=uid_, role="member"))
    db.commit()
    db.refresh(group)
    db.refresh(mine)

    for uid_ in member_ids:
        notify(db, uid_, f'{user.full_name} added you to the group "{group.name}"',
               ntype="message", link=f"/messages/group/{group.id}")
    return _summary(db, group, mine)


@router.get("/unread-count")
def groups_unread(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    mems = db.query(ChatGroupMember).filter(ChatGroupMember.user_id == user.id).all()
    return {"unread": sum(_unread(db, m) for m in mems)}


@router.get("/{group_id}")
def group_detail(group_id: str, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    mem = _require_member(db, group_id, user.id)
    g = db.get(ChatGroup, group_id)

    # opening the group marks everything as read
    mem.last_read_at = datetime.utcnow()
    db.commit()

    msgs = db.query(ChatGroupMessage).filter(
        ChatGroupMessage.group_id == group_id
    ).order_by(ChatGroupMessage.created_at.desc()).limit(200).all()
    msgs.reverse()

    members = sorted(g.members, key=lambda m: (m.role != "admin", m.joined_at))
    return {
        "id": g.id,
        "name": g.name,
        "description": g.description or "",
        "created_by": g.created_by,
        "my_role": mem.role,
        "members": [{
            "user_id": m.user_id,
            "full_name": m.user.full_name if m.user else "Former member",
            "is_badge_verified": bool(m.user and m.user.is_badge_verified),
            "role": m.user.profile.professional_role if m.user and m.user.profile else "",
            "group_role": m.role,
        } for m in members],
        "messages": [_msg(m) for m in msgs],
    }


@router.put("/{group_id}")
def update_group(group_id: str, data: GroupUpdate, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    _require_admin(db, group_id, user.id)
    g = db.get(ChatGroup, group_id)
    g.name = data.name
    g.description = data.description.strip()
    db.commit()
    return {"message": "Group updated"}


@router.delete("/{group_id}")
def delete_group(group_id: str, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    _require_admin(db, group_id, user.id)
    db.delete(db.get(ChatGroup, group_id))
    db.commit()
    return {"message": "Group deleted"}


@router.post("/{group_id}/messages")
def send_message(group_id: str, data: MessageIn, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    mem = _require_member(db, group_id, user.id)
    g = db.get(ChatGroup, group_id)

    # Only notify members who have nothing unread yet, so a busy chat does not spam them.
    # Must be computed BEFORE the new message is stored.
    to_notify = [m.user_id for m in g.members
                 if m.user_id != user.id and _unread(db, m) == 0]

    msg = ChatGroupMessage(group_id=group_id, sender_id=user.id, content=data.content)
    db.add(msg)
    mem.last_read_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    for uid_ in to_notify:
        notify(db, uid_, f'New message in "{g.name}"',
               ntype="message", link=f"/messages/group/{group_id}")
    return _msg(msg)


@router.post("/{group_id}/members")
def add_members(group_id: str, data: MembersAdd, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    _require_admin(db, group_id, user.id)
    g = db.get(ChatGroup, group_id)

    wanted = _valid_connection_ids(db, user, data.user_ids)
    existing = {m.user_id for m in g.members}
    new_ids = wanted - existing
    if len(existing) + len(new_ids) > MAX_MEMBERS:
        raise HTTPException(400, f"A group can have at most {MAX_MEMBERS} members")

    for uid_ in new_ids:
        db.add(ChatGroupMember(group_id=group_id, user_id=uid_, role="member"))
    db.commit()

    for uid_ in new_ids:
        notify(db, uid_, f'{user.full_name} added you to the group "{g.name}"',
               ntype="message", link=f"/messages/group/{group_id}")
    return {"added": len(new_ids)}


@router.delete("/{group_id}/members/{member_id}")
def remove_member(group_id: str, member_id: str, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    """An admin removes someone, or any member leaves (member_id == their own id)."""
    me = _require_member(db, group_id, user.id)
    if member_id != user.id and me.role != "admin":
        raise HTTPException(403, "Only group admins can remove other members")

    target = _membership(db, group_id, member_id)
    if not target:
        raise HTTPException(404, "Member not found in this group")
    db.delete(target)
    db.flush()

    remaining = db.query(ChatGroupMember).filter(
        ChatGroupMember.group_id == group_id
    ).order_by(ChatGroupMember.joined_at).all()

    group_deleted = False
    if not remaining:
        db.delete(db.get(ChatGroup, group_id))   # last person left
        group_deleted = True
    elif not any(m.role == "admin" for m in remaining):
        remaining[0].role = "admin"              # hand the group to the longest-standing member
    db.commit()
    return {"ok": True, "group_deleted": group_deleted}