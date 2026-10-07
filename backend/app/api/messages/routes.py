from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Connection, DirectMessage, User
from app.services.notifications import notify

router = APIRouter(prefix="/api/messages", tags=["messages"])


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        return v


# ---------------------------------------------------------------- helpers
def _are_connected(db: Session, a: str, b: str) -> bool:
    return db.query(Connection).filter(
        Connection.status == "accepted",
        or_(
            and_(Connection.requester_id == a, Connection.addressee_id == b),
            and_(Connection.requester_id == b, Connection.addressee_id == a),
        ),
    ).first() is not None


def _get_chat_partner(db: Session, me: User, user_id: str) -> User:
    other = db.get(User, user_id)
    if not other or other.is_suspended:
        raise HTTPException(404, "Member not found")
    if other.id == me.id:
        raise HTTPException(400, "You cannot message yourself")
    if not _are_connected(db, me.id, other.id):
        raise HTTPException(403, "You can only message your connections")
    return other


def _iso(dt: datetime) -> str:
    return dt.isoformat() + "Z"  # stored as naive UTC


def _serialize(m: DirectMessage) -> dict:
    return {"id": m.id, "sender_id": m.sender_id, "recipient_id": m.recipient_id,
            "content": m.content, "is_read": bool(m.is_read), "created_at": _iso(m.created_at)}


# ---------------------------------------------------------------- endpoints
# Fixed paths first, "/{user_id}" last.
@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.query(DirectMessage).filter(
        DirectMessage.recipient_id == user.id, DirectMessage.is_read == False).count()  # noqa: E712
    return {"unread": n}


@router.get("/conversations")
def conversations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Connection).filter(
        Connection.status == "accepted",
        or_(Connection.requester_id == user.id, Connection.addressee_id == user.id)).all()

    out = []
    for c in rows:
        other_id = c.addressee_id if c.requester_id == user.id else c.requester_id
        other = db.get(User, other_id)
        if not other or other.is_suspended:
            continue
        last = db.query(DirectMessage).filter(
            or_(
                and_(DirectMessage.sender_id == user.id, DirectMessage.recipient_id == other_id),
                and_(DirectMessage.sender_id == other_id, DirectMessage.recipient_id == user.id),
            )
        ).order_by(DirectMessage.created_at.desc()).first()
        unread = db.query(DirectMessage).filter(
            DirectMessage.sender_id == other_id,
            DirectMessage.recipient_id == user.id,
            DirectMessage.is_read == False).count()  # noqa: E712
        out.append({
            "user_id": other_id,
            "full_name": other.full_name,
            "role": other.profile.professional_role if other.profile else "",
            "last_message": last.content if last else "",
            "last_message_at": _iso(last.created_at) if last else None,
            "last_from_me": bool(last and last.sender_id == user.id),
            "unread": unread,
        })

    out.sort(key=lambda r: (r["last_message_at"] or "", r["full_name"].lower()), reverse=True)
    return out


@router.get("/{user_id}")
def thread(user_id: str, db: Session = Depends(get_db),
           user: User = Depends(get_current_user)):
    other = _get_chat_partner(db, user, user_id)

    # opening the thread marks their messages to me as read
    db.query(DirectMessage).filter(
        DirectMessage.sender_id == other.id,
        DirectMessage.recipient_id == user.id,
        DirectMessage.is_read == False,  # noqa: E712
    ).update({DirectMessage.is_read: True}, synchronize_session=False)
    db.commit()

    msgs = db.query(DirectMessage).filter(
        or_(
            and_(DirectMessage.sender_id == user.id, DirectMessage.recipient_id == other.id),
            and_(DirectMessage.sender_id == other.id, DirectMessage.recipient_id == user.id),
        )
    ).order_by(DirectMessage.created_at.desc()).limit(200).all()
    msgs.reverse()

    return {
        "user": {"id": other.id, "full_name": other.full_name,
                 "role": other.profile.professional_role if other.profile else ""},
        "messages": [_serialize(m) for m in msgs],
    }


@router.post("/{user_id}")
def send_message(user_id: str, data: MessageIn, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    other = _get_chat_partner(db, user, user_id)

    # only notify when this starts a new unread run, so chat does not spam notifications
    already_unread = db.query(DirectMessage).filter(
        DirectMessage.sender_id == user.id,
        DirectMessage.recipient_id == other.id,
        DirectMessage.is_read == False).first() is not None  # noqa: E712

    msg = DirectMessage(sender_id=user.id, recipient_id=other.id, content=data.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)

    if not already_unread:
        notify(db, other.id, f"New message from {user.full_name}",
               ntype="message", link=f"/messages/{user.id}")
    return _serialize(msg)