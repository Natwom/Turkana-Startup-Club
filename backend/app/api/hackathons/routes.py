from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Hackathon, HackathonParticipant, HackathonTrack, User
from app.services.notifications import notify

router = APIRouter(prefix="/api/hackathons", tags=["hackathons"])

VISIBLE = ("upcoming", "live", "judging", "completed")   # archived stays hidden
OPEN_FOR_JOINING = ("upcoming", "live")


def _out(h: Hackathon, db: Session) -> dict:
    return {
        "id": h.id, "name": h.name, "description": h.description,
        "starts_at": h.starts_at, "ends_at": h.ends_at, "venue": h.venue,
        "status": h.status,
        "participants": db.query(HackathonParticipant)
                          .filter_by(hackathon_id=h.id).count(),
    }


@router.get("")
def list_hackathons(db: Session = Depends(get_db)):
    rows = (db.query(Hackathon).filter(Hackathon.status.in_(VISIBLE))
            .order_by(Hackathon.starts_at.desc()).all())
    return [_out(h, db) for h in rows]


@router.get("/my")
def my_hackathons(db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    parts = db.query(HackathonParticipant).filter_by(user_id=user.id).all()
    return [p.hackathon_id for p in parts]


@router.get("/{hackathon_id}")
def hackathon_detail(hackathon_id: str, db: Session = Depends(get_db)):
    h = db.get(Hackathon, hackathon_id)
    if not h or h.status not in VISIBLE:
        raise HTTPException(404, "Hackathon not found")
    tracks = db.query(HackathonTrack).filter_by(hackathon_id=h.id).all()
    return {
        **_out(h, db),
        "rules": h.rules, "schedule": h.schedule,
        "tracks": [{"id": t.id, "name": t.name, "description": t.description}
                   for t in tracks],
    }


@router.post("/{hackathon_id}/join")
def join_hackathon(hackathon_id: str, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    h = db.get(Hackathon, hackathon_id)
    if not h or h.status not in VISIBLE:
        raise HTTPException(404, "Hackathon not found")
    if h.status not in OPEN_FOR_JOINING:
        raise HTTPException(400, "Registration for this hackathon is closed")
    db.add(HackathonParticipant(hackathon_id=h.id, user_id=user.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "You have already joined this hackathon")
    notify(db, user.id, f"You joined {h.name}", ntype="hackathon", link="/hackathons")
    return {"message": f"You joined {h.name}"}


@router.post("/{hackathon_id}/leave")
def leave_hackathon(hackathon_id: str, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    p = db.query(HackathonParticipant).filter_by(
        hackathon_id=hackathon_id, user_id=user.id).first()
    if not p:
        raise HTTPException(404, "You are not registered for this hackathon")
    db.delete(p)
    db.commit()
    return {"message": "You left the hackathon"}