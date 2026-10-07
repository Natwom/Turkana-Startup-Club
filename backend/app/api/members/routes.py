from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Connection, MemberProfile, Skill, User
from app.schemas.member import ProfileUpdate
from app.services.notifications import notify

router = APIRouter(prefix="/api/members", tags=["members"])


# ---------------------------------------------------------------- helpers
def _find_connection(db: Session, a: str, b: str):
    """Return the connection row between two users, in either direction."""
    return db.query(Connection).filter(
        or_(
            and_(Connection.requester_id == a, Connection.addressee_id == b),
            and_(Connection.requester_id == b, Connection.addressee_id == a),
        )
    ).first()


def _status_for(conn: Connection | None, me_id: str) -> str:
    """none | pending_sent | pending_received | connected"""
    if not conn:
        return "none"
    if conn.status == "accepted":
        return "connected"
    if conn.status == "pending":
        return "pending_sent" if conn.requester_id == me_id else "pending_received"
    return "none"  # rejected / removed


# ---------------------------------------------------------------- directory
@router.get("")
def directory(q: str = "", member_type: str = "", county: str = "", chapter_id: str = "",
              skill: str = "", db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    query = (
        db.query(User)
        .join(MemberProfile)
        .filter(User.is_suspended == False)  # noqa: E712
        .filter(User.id != user.id)  # never list the current user
    )
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            User.full_name.ilike(like),
            MemberProfile.institution.ilike(like),
            MemberProfile.professional_role.ilike(like),
            MemberProfile.skills.any(Skill.name.ilike(like)),
        ))
    if member_type:
        query = query.filter(MemberProfile.member_type == member_type)
    if county:
        query = query.filter(MemberProfile.county == county)
    if chapter_id:
        query = query.filter(MemberProfile.chapter_id == chapter_id)
    if skill:
        query = query.filter(MemberProfile.skills.any(Skill.name == skill.lower()))
    users = query.order_by(User.created_at.desc()).limit(100).all()

    mine = db.query(Connection).filter(
        or_(Connection.requester_id == user.id, Connection.addressee_id == user.id)
    ).all()
    status_by_user = {}
    for c in mine:
        other_id = c.addressee_id if c.requester_id == user.id else c.requester_id
        status_by_user[other_id] = _status_for(c, user.id)

    return [
        {
            "id": u.id, "full_name": u.full_name,
            "photo_url": u.profile.photo_url if u.profile else "",
            "role": u.profile.professional_role if u.profile else "",
            "member_type": u.profile.member_type if u.profile else "",
            "bio": (u.profile.bio if u.profile and u.profile.profile_public else ""),
            "skills": [s.name for s in u.profile.skills] if u.profile else [],
            "county": u.profile.county if u.profile else "",
            "connection_status": status_by_user.get(u.id, "none"),
        }
        for u in users
    ]


# ---------------------------------------------------------------- profile
@router.put("/me")
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    p = user.profile
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "skills":
            p.skills.clear()
            for name in value or []:
                skill = db.query(Skill).filter(Skill.name == name.lower()).first() or Skill(name=name.lower())
                p.skills.append(skill)
        else:
            setattr(p, field, value)
    db.commit()
    return {"message": "Profile updated"}


# ---------------------------------------------------------------- connections
@router.get("/connections")
def my_connections(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Connection).filter(
        ((Connection.requester_id == user.id) | (Connection.addressee_id == user.id)),
        Connection.status == "accepted").all()
    out = []
    for c in rows:
        other_id = c.addressee_id if c.requester_id == user.id else c.requester_id
        other = db.get(User, other_id)
        if not other or other.is_suspended:
            continue
        out.append({
            "connection_id": c.id, "user_id": other_id,
            "full_name": other.full_name,
            "role": other.profile.professional_role if other.profile else "",
            "member_type": other.profile.member_type if other.profile else "",
            "skills": [s.name for s in other.profile.skills] if other.profile else [],
        })
    return out


@router.get("/connections/requests")
def incoming_requests(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Pending requests other members have sent to me."""
    rows = db.query(Connection).filter(
        Connection.addressee_id == user.id, Connection.status == "pending").all()
    out = []
    for c in rows:
        other = db.get(User, c.requester_id)
        if not other or other.is_suspended:
            continue
        out.append({"connection_id": c.id, "user_id": other.id,
                    "full_name": other.full_name,
                    "role": other.profile.professional_role if other.profile else ""})
    return out


@router.post("/{user_id}/connect")
def connect(user_id: str, db: Session = Depends(get_db),
            user: User = Depends(get_current_user)):
    if user_id == user.id:
        raise HTTPException(400, "You cannot connect with yourself")

    other = db.get(User, user_id)
    if not other or other.is_suspended:
        raise HTTPException(404, "Member not found")

    existing = _find_connection(db, user.id, user_id)

    if existing:
        if existing.status == "accepted":
            return {"message": "You are already connected", "status": "connected"}

        if existing.status == "pending":
            if existing.requester_id == user.id:
                return {"message": "Request already sent", "status": "pending_sent"}
            existing.status = "accepted"
            existing.updated_at = datetime.utcnow()
            db.commit()
            notify(db, user_id, f"{user.full_name} accepted your connection request",
                   ntype="connection", link="/network")
            return {"message": "Connection accepted", "status": "connected"}

        # rejected / removed: reuse the same row (the unique constraint forbids a duplicate)
        existing.requester_id = user.id
        existing.addressee_id = user_id
        existing.status = "pending"
        existing.updated_at = datetime.utcnow()
        db.commit()
    else:
        db.add(Connection(requester_id=user.id, addressee_id=user_id, status="pending"))
        db.commit()

    notify(db, user_id, f"{user.full_name} wants to connect",
           ntype="connection", link="/network")
    return {"message": "Connection request sent", "status": "pending_sent"}


@router.post("/{user_id}/connect/accept")
def accept_connection(user_id: str, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    conn = db.query(Connection).filter(
        Connection.requester_id == user_id,
        Connection.addressee_id == user.id,
        Connection.status == "pending").first()
    if not conn:
        raise HTTPException(404, "No pending request from this member")
    conn.status = "accepted"
    conn.updated_at = datetime.utcnow()
    db.commit()
    notify(db, user_id, f"{user.full_name} accepted your connection request",
           ntype="connection", link="/network")
    return {"message": "Connection accepted", "status": "connected"}


@router.post("/{user_id}/connect/decline")
def decline_connection(user_id: str, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    conn = db.query(Connection).filter(
        Connection.requester_id == user_id,
        Connection.addressee_id == user.id,
        Connection.status == "pending").first()
    if not conn:
        raise HTTPException(404, "No pending request from this member")
    conn.status = "rejected"
    conn.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Request declined", "status": "none"}


@router.delete("/{user_id}/connect")
def remove_connection(user_id: str, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    """Cancel a request I sent, or disconnect from an existing connection."""
    conn = _find_connection(db, user.id, user_id)
    if not conn or conn.status not in ("pending", "accepted"):
        raise HTTPException(404, "No connection to remove")
    if conn.status == "pending" and conn.requester_id != user.id:
        raise HTTPException(400, "Use decline for requests sent to you")
    conn.status = "removed"
    conn.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Connection removed", "status": "none"}


# ---------------------------------------------------------------- single profile
# NOTE: must stay AFTER the fixed GET routes above ("/connections"), or it would shadow them.
@router.get("/{user_id}")
def member_profile(user_id: str, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    other = db.get(User, user_id)
    if not other or other.is_suspended:
        raise HTTPException(404, "Member not found")

    is_self = other.id == user.id
    conn = None if is_self else _find_connection(db, user.id, other.id)
    status = "self" if is_self else _status_for(conn, user.id)
    can_see_private = is_self or status == "connected"

    p = other.profile
    data = {
        "id": other.id,
        "full_name": other.full_name,
        "photo_url": p.photo_url if p else "",
        "role": p.professional_role if p else "",
        "member_type": p.member_type if p else "",
        "institution": p.institution if p else "",
        "county": p.county if p else "",
        "experience_level": p.experience_level if p else "",
        "skills": [s.name for s in p.skills] if p else [],
        "bio": (p.bio if p and (p.profile_public or can_see_private) else ""),
        "connection_status": status,
        "contact": None,
    }
    if can_see_private and p:
        data["contact"] = {
            "phone": other.phone or "",
            "linkedin": p.linkedin or "",
            "github": p.github or "",
            "portfolio": p.portfolio or "",
            "startup_info": p.startup_info or "",
            "interests": p.interests or [],
        }
    return data