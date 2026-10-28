# services/verification.py
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Connection, User
from app.services.audit import log_action
from app.services.notifications import notify


def count_connections(db: Session, user_id: str) -> int:
    """Accepted connections whose other side is not suspended."""
    rows = db.query(Connection).filter(
        or_(Connection.requester_id == user_id, Connection.addressee_id == user_id),
        Connection.status == "accepted",
    ).all()
    other_ids = [c.addressee_id if c.requester_id == user_id else c.requester_id for c in rows]
    if not other_ids:
        return 0
    return db.query(User).filter(
        User.id.in_(other_ids), User.is_suspended == False  # noqa: E712
    ).count()


def auto_verify_if_eligible(db: Session, user_id: str) -> bool:
    """Award the verified badge once the user reaches the connection threshold.
    Returns True if the badge was newly awarded. The badge is permanent."""
    user = db.get(User, user_id)
    if not user or user.is_badge_verified or user.is_suspended:
        return False

    total = count_connections(db, user_id)
    if total < settings.AUTO_VERIFY_CONNECTIONS:
        return False

    user.is_badge_verified = True
    db.commit()

    log_action(db, None, "badge.auto_award", "user", user.id,
               metadata={"connections": total, "threshold": settings.AUTO_VERIFY_CONNECTIONS})
    notify(db, user.id, "You earned the verified badge ✅",
           body=f"You reached {settings.AUTO_VERIFY_CONNECTIONS} connections, so a verified badge now shows on your profile.",
           ntype="verification", link="/network")
    return True


def auto_verify_users(db: Session, *user_ids: str) -> None:
    """Check several users. Never lets a badge problem break the calling request."""
    for uid in user_ids:
        try:
            auto_verify_if_eligible(db, uid)
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            print(f"[auto_verify] failed for {uid}: {exc}")