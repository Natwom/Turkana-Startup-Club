import re
import secrets
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models as M
from app.api.deps import get_current_user, require_permission
from app.db.session import get_db
from app.services.audit import log_action
from app.services.notifications import notify

router = APIRouter(prefix="/api/admin", tags=["admin-manage"])
public_router = APIRouter(prefix="/api/certificates", tags=["certificates"])


# ---------------------------------------------------------------- helpers
def _clean(payload: dict) -> dict:
    out = {}
    for k, v in (payload or {}).items():
        if isinstance(v, str):
            v = v.strip()
        if v is None or v == "":
            continue
        out[k] = v
    return out


def _parse_dt(value, field: str) -> datetime:
    try:
        return datetime.fromisoformat(str(value).replace("Z", ""))
    except ValueError:
        raise HTTPException(422, f"Invalid date/time for '{field}'")


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _user_by_email(db: Session, email: str):
    u = db.query(M.User).filter(func.lower(M.User.email) == str(email).lower()).first()
    if not u:
        raise HTTPException(404, f"No member found with email {email}")
    return u


# ------------------------------------------------- generic CREATE endpoints
# path (POST /api/admin/<path>) -> spec
CREATE_SPECS = {
    "chapters": dict(
        model="Chapter", perm="chapters.manage", label="Chapter", audit="chapter.create",
        required=["name"], fields=["name", "description", "location"], slug=True),
    "hackathons": dict(
        model="Hackathon", perm="hackathons.manage", label="Hackathon", audit="hackathon.create",
        required=["name", "starts_at"],
        fields=["name", "description", "venue", "rules", "schedule", "starts_at", "ends_at"],
        dates=["starts_at", "ends_at"]),
    "hackathons/challenges": dict(
        model="HackathonTrack", perm="hackathons.manage", label="Challenge", audit="hackathon.track",
        required=["hackathon_id", "name"], fields=["hackathon_id", "name", "description"],
        parent=("hackathon_id", "Hackathon")),
    "hackathons/criteria": dict(
        model="JudgingCriterion", perm="hackathons.manage", label="Criterion", audit="hackathon.criterion",
        required=["hackathon_id", "name"], fields=["hackathon_id", "name", "weight", "max_score"],
        ints=["weight", "max_score"], parent=("hackathon_id", "Hackathon")),
    "hackathons/judges": dict(
        model="HackathonJudge", perm="hackathons.manage", label="Judge", audit="hackathon.judge",
        required=["hackathon_id", "user_email"], fields=["hackathon_id"], user_email=True,
        parent=("hackathon_id", "Hackathon")),
    "hackathons/participants": dict(
        model="HackathonParticipant", perm="hackathons.manage", label="Participant",
        audit="hackathon.participant",
        required=["hackathon_id", "user_email"], fields=["hackathon_id"], user_email=True,
        parent=("hackathon_id", "Hackathon")),
    "opportunities": dict(
        model="Opportunity", perm="content.manage", label="Opportunity", audit="opportunity.create",
        required=["title"],
        fields=["type", "title", "organization", "description", "location", "link", "deadline"],
        dates=["deadline"], defaults={"status": "approved"}),
    "resources": dict(
        model="Resource", perm="content.manage", label="Resource", audit="resource.create",
        required=["title"], fields=["category", "title", "description", "external_url"],
        defaults={"status": "approved"}),
    "sponsors": dict(
        model="Sponsor", perm="content.manage", label="Sponsor/partner", audit="sponsor.create",
        required=["name"],
        fields=["name", "description", "website", "contact_email", "partnership_type"],
        defaults={"status": "approved"}),
    "achievements/badges": dict(
        model="Badge", perm="content.manage", label="Badge", audit="badge.create",
        required=["name"], fields=["name", "description", "icon"]),
    "incubation/programs": dict(
        model="IncubationProgram", perm="incubation.manage", label="Program", audit="incubation.create",
        required=["name"],
        fields=["name", "description", "cohort_name", "application_deadline", "status"],
        dates=["application_deadline"]),
}


def _create_endpoint(spec: dict):
    def endpoint(request: Request,
                 payload: dict = Body(...),
                 db: Session = Depends(get_db),
                 admin: M.User = Depends(require_permission(spec["perm"]))):
        data = _clean(payload)
        for r in spec.get("required", []):
            if r not in data:
                raise HTTPException(422, f"'{r}' is required")

        values = {k: data[k] for k in spec["fields"] if k in data}
        for f in spec.get("dates", []):
            if f in values:
                values[f] = _parse_dt(values[f], f)
        for f in spec.get("ints", []):
            if f in values:
                try:
                    values[f] = int(values[f])
                except (TypeError, ValueError):
                    raise HTTPException(422, f"'{f}' must be a number")
        if spec.get("parent"):
            field, parent_model = spec["parent"]
            if not db.get(getattr(M, parent_model), values.get(field)):
                raise HTTPException(404, f"{parent_model} not found")
        if spec.get("user_email"):
            values["user_id"] = _user_by_email(db, data["user_email"]).id
        if spec.get("slug"):
            values["slug"] = _slugify(values["name"])

        obj = getattr(M, spec["model"])(**{**spec.get("defaults", {}), **values})
        db.add(obj)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, f"That {spec['label'].lower()} already exists")
        db.refresh(obj)
        log_action(db, admin.id, spec["audit"], spec["model"], str(obj.id), request=request)
        return {"id": str(obj.id), "message": f"{spec['label']} created"}
    return endpoint


for _path, _spec in CREATE_SPECS.items():
    router.add_api_route(f"/{_path}", _create_endpoint(_spec), methods=["POST"],
                         name=f"create_{_path.replace('/', '_')}")


# ------------------------------------------- generic ROW ACTION endpoints
# base -> (model, permission, {action: {column: new value}})
ACTIONS = {
    "projects": ("Project", "content.manage", {
        "approve": {"status": "approved"}, "reject": {"status": "rejected"},
        "feature": {"is_featured": "1"}, "unfeature": {"is_featured": "0"}}),
    "startups": ("Startup", "content.manage", {
        "verify": {"status": "verified"}, "reject": {"status": "rejected"},
        "feature": {"is_featured": "1"}, "unfeature": {"is_featured": "0"}}),
    "opportunities": ("Opportunity", "content.manage", {
        "approve": {"status": "approved"}, "close": {"status": "closed"}}),
    "resources": ("Resource", "content.manage", {
        "approve": {"status": "approved"}, "reject": {"status": "rejected"}}),
    "sponsors": ("Sponsor", "content.manage", {"approve": {"status": "approved"}}),
    "volunteers": ("VolunteerApplication", "volunteers.manage", {
        "approve": {"status": "approved"}, "reject": {"status": "rejected"}}),
    "mentorship/requests": ("MentorshipRequest", "mentorship.manage", {
        "accept": {"status": "accepted"}, "reject": {"status": "rejected"}}),
    "moderation/reports": ("ModerationReport", "moderation.manage", {
        "dismiss": {"status": "dismissed"}, "resolve": {"status": "resolved"}}),
    "hackathons": ("Hackathon", "hackathons.manage", {
        "go-live": {"status": "live"}, "start-judging": {"status": "judging"},
        "complete": {"status": "completed"}, "archive": {"status": "archived"}}),
}


def _action_endpoint(model_name: str, perm: str, changes: dict, base: str, action: str):
    def endpoint(item_id: str, request: Request,
                 db: Session = Depends(get_db),
                 admin: M.User = Depends(require_permission(perm))):
        obj = db.get(getattr(M, model_name), item_id)
        if not obj:
            raise HTTPException(404, f"{model_name} not found")
        for k, v in changes.items():
            setattr(obj, k, v)
        db.commit()
        if model_name == "VolunteerApplication":
            notify(db, obj.user_id, f"Your volunteer application was {changes['status']}",
                   ntype="volunteer")
        log_action(db, admin.id, f"{base}.{action}", model_name, item_id, request=request)
        return {"message": f"{action.replace('-', ' ').title()} done"}
    return endpoint


for _base, (_model, _perm, _acts) in ACTIONS.items():
    for _action, _changes in _acts.items():
        router.add_api_route(
            f"/{_base}/{{item_id}}/{_action}",
            _action_endpoint(_model, _perm, _changes, _base, _action),
            methods=["POST"], name=f"action_{_base.replace('/', '_')}_{_action}")


# ------------------------------------------------------ CERTIFICATES (admin)
@router.post("/certificates")
def issue_certificate(request: Request,
                      payload: dict = Body(...),
                      db: Session = Depends(get_db),
                      admin: M.User = Depends(require_permission("certificates.manage"))):
    data = _clean(payload)
    for r in ("user_email", "title"):
        if r not in data:
            raise HTTPException(422, f"'{r}' is required")
    user = _user_by_email(db, data["user_email"])

    code = "TSC-" + secrets.token_hex(4).upper()
    while db.query(M.Certificate).filter(M.Certificate.certificate_id == code).first():
        code = "TSC-" + secrets.token_hex(4).upper()

    cert = M.Certificate(
        certificate_id=code, user_id=user.id,
        activity_type=data.get("activity_type", "event"),
        activity_id=data.get("activity_id"), title=data["title"])
    db.add(cert)
    db.commit()
    notify(db, user.id, f"You received a certificate: {cert.title}",
           body=f"Verification code: {code}", ntype="certificate", link="/certificates")
    log_action(db, admin.id, "certificate.issue", "certificate", cert.id,
               {"code": code, "to": user.email}, request=request)
    return {"id": cert.id, "certificate_id": code,
            "message": f"Certificate {code} issued to {user.full_name}"}


def _cert_rows(db: Session = Depends(get_db)):
    rows = (db.query(M.Certificate, M.User)
            .join(M.User, M.User.id == M.Certificate.user_id)
            .order_by(M.Certificate.issued_at.desc()).limit(200).all())
    return [{
        "certificate_id": c.certificate_id, "member": u.full_name, "email": u.email,
        "activity_type": c.activity_type, "title": c.title, "issued_at": c.issued_at,
    } for c, u in rows]


for _p in ("certificates/issued", "certificates/verification"):
    router.add_api_route(
        f"/{_p}", _cert_rows, methods=["GET"],
        dependencies=[Depends(require_permission("certificates.manage"))],
        name=f"enriched_{_p.replace('/', '_')}")


# ------------------------------------------------- CERTIFICATES (member/public)
@public_router.get("/verify/{code}")
def verify_certificate(code: str, db: Session = Depends(get_db)):
    """Public: anyone can check a certificate code."""
    c = db.query(M.Certificate).filter(
        M.Certificate.certificate_id == code.strip().upper()).first()
    if not c:
        raise HTTPException(404, "Certificate not found")
    u = db.get(M.User, c.user_id)
    return {"valid": True, "certificate_id": c.certificate_id,
            "holder": u.full_name if u else "", "title": c.title,
            "activity_type": c.activity_type, "issued_at": c.issued_at}


@public_router.get("/my")
def my_certificates(db: Session = Depends(get_db),
                    user: M.User = Depends(get_current_user)):
    """The logged-in member's own certificates."""
    rows = (db.query(M.Certificate).filter(M.Certificate.user_id == user.id)
            .order_by(M.Certificate.issued_at.desc()).all())
    return [{
        "id": c.id, "certificate_id": c.certificate_id, "title": c.title,
        "activity_type": c.activity_type, "issued_at": c.issued_at,
        "holder": user.full_name,
    } for c in rows]


# --------------------------------------------------------- BADGES
@router.post("/achievements/award")
def award_badge(request: Request,
                payload: dict = Body(...),
                db: Session = Depends(get_db),
                admin: M.User = Depends(require_permission("content.manage"))):
    data = _clean(payload)
    for r in ("user_email", "badge_id"):
        if r not in data:
            raise HTTPException(422, f"'{r}' is required")
    user = _user_by_email(db, data["user_email"])
    badge = db.get(M.Badge, data["badge_id"])
    if not badge:
        raise HTTPException(404, "Badge not found")
    db.add(M.UserBadge(user_id=user.id, badge_id=badge.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Member already has this badge")
    notify(db, user.id, f"You earned the {badge.name} badge", ntype="badge")
    log_action(db, admin.id, "badge.award", "badge", badge.id,
               {"to": user.email}, request=request)
    return {"message": f"{badge.name} awarded to {user.full_name}"}


# --------------------------------------------------- ANNOUNCEMENTS
@router.post("/communications/announcements")
def send_announcement(request: Request,
                      payload: dict = Body(...),
                      db: Session = Depends(get_db),
                      admin: M.User = Depends(require_permission("content.manage"))):
    data = _clean(payload)
    if "title" not in data:
        raise HTTPException(422, "'title' is required")
    users = db.query(M.User.id).filter(M.User.is_suspended == False).all()  # noqa: E712
    db.add_all([M.Notification(user_id=u[0], title=data["title"],
                               body=data.get("body", ""), ntype="announcement")
                for u in users])
    db.commit()
    log_action(db, admin.id, "announcement.send", "announcement", "",
               {"title": data["title"], "recipients": len(users)}, request=request)
    return {"message": f"Announcement sent to {len(users)} members"}


# ------------------------- readable (name instead of UUID) hackathon lists
def _hack_names(db: Session) -> dict:
    return {h.id: h.name for h in db.query(M.Hackathon).all()}


def _challenges(db: Session = Depends(get_db)):
    names = _hack_names(db)
    return [{"id": t.id, "hackathon": names.get(t.hackathon_id, ""),
             "name": t.name, "description": t.description}
            for t in db.query(M.HackathonTrack).all()]


def _judges(db: Session = Depends(get_db)):
    names = _hack_names(db)
    rows = (db.query(M.HackathonJudge, M.User)
            .join(M.User, M.User.id == M.HackathonJudge.user_id).all())
    return [{"id": j.id, "hackathon": names.get(j.hackathon_id, ""),
             "judge": u.full_name, "email": u.email} for j, u in rows]


def _participants(db: Session = Depends(get_db)):
    names = _hack_names(db)
    rows = (db.query(M.HackathonParticipant, M.User)
            .join(M.User, M.User.id == M.HackathonParticipant.user_id)
            .order_by(M.HackathonParticipant.created_at.desc()).limit(200).all())
    return [{"id": p.id, "hackathon": names.get(p.hackathon_id, ""),
             "participant": u.full_name, "email": u.email,
             "checked_in": p.checked_in == "1", "joined": p.created_at}
            for p, u in rows]


for _p, _fn in (("hackathons/challenges", _challenges),
                ("hackathons/judges", _judges),
                ("hackathons/participants", _participants)):
    router.add_api_route(
        f"/{_p}", _fn, methods=["GET"],
        dependencies=[Depends(require_permission("hackathons.manage"))],
        name=f"enriched_{_p.replace('/', '_')}")