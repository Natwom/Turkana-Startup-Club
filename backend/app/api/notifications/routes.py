from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Notification, User

router = APIRouter(prefix="/api/me/notifications", tags=["notifications"])


@router.get("")
def my_notifications(db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    base = db.query(Notification).filter(Notification.user_id == user.id)
    items = base.order_by(Notification.created_at.desc()).limit(20).all()
    unread = base.filter(Notification.is_read == "0").count()
    return {
        "unread": unread,
        "items": [{
            "id": n.id, "title": n.title, "body": n.body, "link": n.link,
            "ntype": n.ntype, "is_read": n.is_read == "1",
            "created_at": n.created_at,
        } for n in items],
    }


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    (db.query(Notification)
       .filter(Notification.user_id == user.id, Notification.is_read == "0")
       .update({"is_read": "1"}))
    db.commit()
    return {"message": "All notifications marked as read"}


@router.post("/{notification_id}/read")
def mark_read(notification_id: str, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "Notification not found")
    n.is_read = "1"
    db.commit()
    return {"message": "Marked as read"}