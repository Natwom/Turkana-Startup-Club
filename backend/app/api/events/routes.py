import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import (Event, EventAttendance, EventRegistration, Notification, User)
from app.schemas.event import CheckInRequest, EventOut
from app.services.notifications import notify
from app.services.qr import qr_png

router = APIRouter(prefix="/api/events", tags=["events"])


def _registration_out(r: EventRegistration) -> dict:
    return {
        "id": r.id, "registration_id": r.registration_id, "event_id": r.event_id,
        "status": r.status, "checked_in_at": r.checked_in_at,
        "qr_token": r.qr_token,
        "event": {"id": r.event.id, "title": r.event.title, "starts_at": r.event.starts_at,
                  "venue": r.event.venue, "location": r.event.location},
    }


@router.get("", response_model=list[EventOut])
def list_events(status_filter: str = "published", db: Session = Depends(get_db)):
    q = db.query(Event)
    if status_filter:
        q = q.filter(Event.status == status_filter)
    return q.order_by(Event.starts_at.asc()).all()


@router.get("/my")
def my_events(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    regs = db.query(EventRegistration).filter(EventRegistration.user_id == user.id)\
             .order_by(EventRegistration.created_at.desc()).all()
    return [_registration_out(r) for r in regs]


@router.post("/{event_id}/register")
def register(event_id: str, db: Session = Depends(get_db),
             user: User = Depends(get_current_user)):
    event = db.get(Event, event_id)
    if not event or event.status != "published":
        raise HTTPException(404, "Event not found")
    if event.registration_deadline and datetime.utcnow() > event.registration_deadline:
        raise HTTPException(400, "Registration deadline has passed")
    existing = db.query(EventRegistration).filter_by(event_id=event_id, user_id=user.id).first()
    if existing and existing.status != "cancelled":
        raise HTTPException(409, "Already registered for this event")

    confirmed = db.query(EventRegistration).filter_by(event_id=event_id, status="registered").count()
    status = "registered" if confirmed < event.capacity else "waitlist"

    if existing:
        existing.status = status
        existing.qr_token = secrets.token_urlsafe(24)
        existing.registration_id = f"TSC-{secrets.token_hex(3).upper()}"
        reg = existing
    else:
        reg = EventRegistration(
            event_id=event_id, user_id=user.id,
            registration_id=f"TSC-{secrets.token_hex(3).upper()}",
            qr_token=secrets.token_urlsafe(24), status=status)
        db.add(reg)
    db.commit()
    db.refresh(reg)
    notify(db, user.id,
           f"You're {status} for {event.title}" + (" — you're on the waitlist" if status == "waitlist" else ""),
           ntype="event", link="/events")
    return _registration_out(reg)


@router.get("/registrations/{registration_id}/qr")
def registration_qr(registration_id: str, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    reg = db.query(EventRegistration).filter_by(registration_id=registration_id).first()
    if not reg or (reg.user_id != user.id and not
                   {"SUPER_ADMIN", "ADMIN", "EVENT_MANAGER"} & set(user.role_names())):
        raise HTTPException(404, "Ticket not found")
    payload = f"TSC:{reg.event_id}:{reg.registration_id}:{reg.qr_token}"
    return Response(content=qr_png(payload), media_type="image/png")


@router.post("/check-in")
def check_in(data: CheckInRequest, db: Session = Depends(get_db),
             scanner: User = Depends(require_roles("SUPER_ADMIN", "ADMIN", "EVENT_MANAGER"))):
    reg = db.query(EventRegistration).filter_by(qr_token=data.qr_token).first()
    if not reg:
        raise HTTPException(404, "Invalid QR code")
    if reg.status == "waitlist":
        raise HTTPException(400, "This registration is on the waitlist")
    if reg.checked_in_at or db.query(EventAttendance).filter_by(registration_id=reg.id).first():
        raise HTTPException(409, "Already checked in")

    reg.checked_in_at = datetime.utcnow()
    reg.status = "attended"
    db.add(EventAttendance(registration_id=reg.id, event_id=reg.event_id,
                           user_id=reg.user_id, checked_in_by=scanner.id))

    # waitlist promotion
    event = reg.event
    confirmed = db.query(EventRegistration).filter_by(event_id=event.id, status="registered").count()
    waitlisted = db.query(EventRegistration).filter_by(event_id=event.id, status="waitlist")\
                    .order_by(EventRegistration.created_at).all()
    if confirmed < event.capacity and waitlisted:
        nxt = waitlisted[0]
        nxt.status = "registered"
        notify(db, nxt.user_id, f"A spot opened up — you're now registered for {event.title}",
               ntype="event", link="/events")
    db.commit()
    return {"message": f"Checked in: {reg.user.full_name} ({reg.registration_id})"}