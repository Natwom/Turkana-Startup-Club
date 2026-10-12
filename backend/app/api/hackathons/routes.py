import re
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import decode_token
from app.db.session import get_db
from app.models import (Hackathon, HackathonAnswer, HackathonParticipant, HackathonQuestion,
                        HackathonTask, HackathonTrack, TaskSubmission, User)
from app.services.notifications import notify

router = APIRouter(prefix="/api/hackathons", tags=["hackathons"])

VISIBLE = ("upcoming", "live", "judging", "completed")   # archived stays hidden
OPEN_FOR_JOINING = ("upcoming", "live")
LINK_VISIBLE = ("upcoming", "live", "judging")           # meeting link shown to joined members

# Like get_current_user, but returns None instead of failing when there is no/invalid token.
oauth2_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_optional_user(token: str | None = Depends(oauth2_optional),
                      db: Session = Depends(get_db)) -> User | None:
    if not token:
        return None
    try:
        payload = decode_token(token, "access")
    except Exception:
        return None
    user = db.get(User, payload["sub"])
    if not user or user.is_suspended:
        return None
    return user


# ---------------------------------------------------------------- helpers
def _mode(h: Hackathon) -> str:
    return getattr(h, "mode", None) or "in_person"


def _z(dt: datetime | None):
    """Task times are stored as naive UTC; send them with a 'Z' so browsers show local time."""
    return dt.isoformat() + "Z" if dt else None


def _task_state(t: HackathonTask, now: datetime) -> str:
    if t.opens_at and now < t.opens_at:
        return "upcoming"
    if t.closes_at and now >= t.closes_at:
        return "closed"
    return "open"


def _visible_hackathon(db: Session, hackathon_id: str) -> Hackathon:
    h = db.get(Hackathon, hackathon_id)
    if not h or h.status not in VISIBLE:
        raise HTTPException(404, "Hackathon not found")
    return h


def _is_member(db: Session, hackathon_id: str, user_id: str) -> bool:
    return db.query(HackathonParticipant).filter_by(
        hackathon_id=hackathon_id, user_id=user_id).first() is not None


def _out(h: Hackathon, db: Session) -> dict:
    return {
        "id": h.id, "name": h.name, "description": h.description,
        "starts_at": h.starts_at, "ends_at": h.ends_at, "venue": h.venue,
        "mode": _mode(h),
        "status": h.status,
        "participants": db.query(HackathonParticipant)
                          .filter_by(hackathon_id=h.id).count(),
    }


# ---------------------------------------------------------------- list / detail
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
def hackathon_detail(hackathon_id: str, db: Session = Depends(get_db),
                     user: User | None = Depends(get_optional_user)):
    h = _visible_hackathon(db, hackathon_id)
    tracks = db.query(HackathonTrack).filter_by(hackathon_id=h.id).all()
    questions = (db.query(HackathonQuestion).filter_by(hackathon_id=h.id)
                 .order_by(HackathonQuestion.position, HackathonQuestion.created_at).all())

    link = getattr(h, "meeting_url", None)
    is_member = bool(user) and _is_member(db, h.id, user.id)
    show_link = bool(link) and _mode(h) != "in_person" and is_member and h.status in LINK_VISIBLE

    return {
        **_out(h, db),
        "rules": h.rules, "schedule": h.schedule,
        "has_meeting_link": bool(link) and _mode(h) != "in_person",
        "meeting_url": link if show_link else None,
        "tracks": [{"id": t.id, "name": t.name, "description": t.description}
                   for t in tracks],
        "questions": [{"id": q.id, "question": q.question, "required": q.required == "1"}
                      for q in questions],
    }


# ---------------------------------------------------------------- join / leave
@router.post("/{hackathon_id}/join")
def join_hackathon(hackathon_id: str,
                   payload: dict | None = Body(default=None),
                   db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    h = _visible_hackathon(db, hackathon_id)
    if h.status not in OPEN_FOR_JOINING:
        raise HTTPException(400, "Registration for this hackathon is closed")
    if _is_member(db, h.id, user.id):
        raise HTTPException(409, "You have already joined this hackathon")

    # registration questions
    questions = (db.query(HackathonQuestion).filter_by(hackathon_id=h.id)
                 .order_by(HackathonQuestion.position, HackathonQuestion.created_at).all())
    raw = (payload or {}).get("answers") or {}
    if not isinstance(raw, dict):
        raise HTTPException(422, "Invalid answers")
    answers, missing = {}, []
    for q in questions:
        a = str(raw.get(q.id, "") or "").strip()
        if len(a) > 2000:
            raise HTTPException(422, "Each answer must be under 2000 characters")
        if q.required == "1" and not a:
            missing.append(q.question)
        if a:
            answers[q.id] = a
    if missing:
        raise HTTPException(422, "Please answer: " + "; ".join(missing))

    db.add(HackathonParticipant(hackathon_id=h.id, user_id=user.id))
    for qid, a in answers.items():
        db.add(HackathonAnswer(hackathon_id=h.id, question_id=qid, user_id=user.id, answer=a))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "You have already joined this hackathon")

    body = ""
    if _mode(h) != "in_person":
        body = "Open the hackathon details to find the online meeting link and your tasks."
    notify(db, user.id, f"You joined {h.name}", body=body,
           ntype="hackathon", link="/hackathons")
    return {"message": f"You joined {h.name}"}


@router.post("/{hackathon_id}/leave")
def leave_hackathon(hackathon_id: str, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    p = db.query(HackathonParticipant).filter_by(
        hackathon_id=hackathon_id, user_id=user.id).first()
    if not p:
        raise HTTPException(404, "You are not registered for this hackathon")
    # remove registration answers so they are asked again if the member rejoins
    db.query(HackathonAnswer).filter_by(hackathon_id=hackathon_id, user_id=user.id).delete()
    db.delete(p)
    db.commit()
    return {"message": "You left the hackathon"}


# ---------------------------------------------------------------- tasks
@router.get("/{hackathon_id}/tasks")
def my_tasks(hackathon_id: str, db: Session = Depends(get_db),
             user: User = Depends(get_current_user)):
    h = _visible_hackathon(db, hackathon_id)
    if not _is_member(db, h.id, user.id):
        raise HTTPException(403, "Join this hackathon to see its tasks")

    now = datetime.utcnow()
    tasks = (db.query(HackathonTask).filter_by(hackathon_id=h.id)
             .order_by(HackathonTask.position, HackathonTask.created_at).all())
    subs = {s.task_id: s for s in
            db.query(TaskSubmission).filter_by(hackathon_id=h.id, user_id=user.id).all()}

    out = []
    for t in tasks:
        state = _task_state(t, now)
        s = subs.get(t.id)
        reviewed = s is not None and s.score is not None
        out.append({
            "id": t.id, "title": t.title, "points": t.points,
            "instructions": t.instructions if state != "upcoming" else None,
            "opens_at": _z(t.opens_at), "closes_at": _z(t.closes_at),
            "submission_type": t.submission_type or "either",
            "state": state,
            "submission": None if not s else {
                "link": s.link, "text": s.text, "submitted_at": _z(s.updated_at or s.submitted_at),
                "reviewed": reviewed,
                "score": s.score if reviewed else None,
                "feedback": s.feedback if reviewed else "",
            },
        })
    return out


@router.post("/{hackathon_id}/tasks/{task_id}/submit")
def submit_task(hackathon_id: str, task_id: str,
                payload: dict = Body(...),
                db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    h = _visible_hackathon(db, hackathon_id)
    if h.status not in OPEN_FOR_JOINING:
        raise HTTPException(400, "Submissions are closed for this hackathon")
    if not _is_member(db, h.id, user.id):
        raise HTTPException(403, "Join this hackathon to submit tasks")

    t = db.get(HackathonTask, task_id)
    if not t or t.hackathon_id != h.id:
        raise HTTPException(404, "Task not found")

    state = _task_state(t, datetime.utcnow())
    if state == "upcoming":
        raise HTTPException(400, "This task has not opened yet")
    if state == "closed":
        raise HTTPException(400, "This task is closed")

    link = str(payload.get("link") or "").strip()
    text = str(payload.get("text") or "").strip()
    stype = t.submission_type or "either"
    if stype == "link":
        text = ""
    elif stype == "text":
        link = ""

    if stype == "link" and not link:
        raise HTTPException(422, "Please add a link")
    if stype == "text" and not text:
        raise HTTPException(422, "Please write your answer")
    if stype == "either" and not (link or text):
        raise HTTPException(422, "Please add a link or write your answer")
    if link and not re.match(r"^https?://", link, re.IGNORECASE):
        raise HTTPException(422, "The link must start with http:// or https://")
    if len(link) > 500:
        raise HTTPException(422, "The link is too long")
    if len(text) > 5000:
        raise HTTPException(422, "Your answer must be under 5000 characters")

    sub = db.query(TaskSubmission).filter_by(task_id=t.id, user_id=user.id).first()
    if sub and sub.score is not None:
        raise HTTPException(400, "This submission has already been reviewed and can't be changed")
    if sub:
        sub.link, sub.text = link, text
    else:
        db.add(TaskSubmission(task_id=t.id, hackathon_id=h.id, user_id=user.id,
                              link=link, text=text))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Please try again")
    return {"message": "Submission saved"}