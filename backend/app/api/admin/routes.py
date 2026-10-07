from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import func, inspect as sa_inspect
from sqlalchemy.orm import Session

from app import models as models_pkg
from app.models import admin as _m_admin, community as _m_comm
from app.models import ecosystem as _m_eco, events as _m_ev, user as _m_user
from app.api.deps import require_permission
from app.core.config import settings
from app.db.session import get_db
from app.models import (
    AuditLog, Certificate, Chapter, Event, EventAttendance, EventRegistration,
    Hackathon, Mentor, ModerationReport, Opportunity, Post, Project, Role,
    Startup, User, MemberProfile, VolunteerApplication,
)
from app.schemas.event import EventCreate
from app.services.audit import log_action
from app.services.notifications import notify

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _count(db: Session, model, *filters):
    q = db.query(func.count(model.id))
    for f in filters:
        q = q.filter(f)
    return q.scalar() or 0


# ---------- DASHBOARD ----------
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db),
              _: User = Depends(require_permission("admin.dashboard"))):
    return {
        "totals": {
            "members": _count(db, User),
            "verified_members": _count(db, User, User.is_verified == True),  # noqa: E712
            "pending_verification": _count(db, User, User.is_verified == False),  # noqa: E712
            "events": _count(db, Event),
            "event_registrations": _count(db, EventRegistration),
            "attendance": _count(db, EventAttendance),
            "hackathons": _count(db, Hackathon),
            "projects": _count(db, Project),
            "startups": _count(db, Startup),
            "mentors": _count(db, Mentor),
            "volunteers": _count(db, VolunteerApplication),
            "chapters": _count(db, Chapter),
            "opportunities": _count(db, Opportunity),
            "certificates": _count(db, Certificate),
            "posts": _count(db, Post),
        },
        "pending_actions": {
            "members_waiting_verification": _count(db, User, User.is_verified == False),  # noqa: E712
            "projects_waiting_approval": _count(db, Project, Project.status == "pending"),
            "startups_waiting_approval": _count(db, Startup, Startup.status == "pending"),
            "opportunities_waiting_approval": _count(db, Opportunity, Opportunity.status == "pending"),
            "open_reports": _count(db, ModerationReport, ModerationReport.status == "open"),
            "upcoming_events": _count(db, Event, Event.status == "published"),
        },
    }


# ---------- MEMBER MANAGEMENT ----------
@router.get("/members")
def members(verification: str = "all", suspended: str = "all", q: str = "",
            db: Session = Depends(get_db),
            _: User = Depends(require_permission("members.view"))):
    query = db.query(User).join(MemberProfile)
    if verification == "pending":
        query = query.filter(User.is_verified == False)  # noqa: E712
    elif verification == "verified":
        query = query.filter(User.is_verified == True)  # noqa: E712
    if suspended == "yes":
        query = query.filter(User.is_suspended == True)  # noqa: E712
    elif suspended == "no":
        query = query.filter(User.is_suspended == False)  # noqa: E712
    if q:
        query = query.filter(User.full_name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%"))
    users = query.order_by(User.created_at.desc()).limit(200).all()
    return [{
        "id": u.id, "full_name": u.full_name, "email": u.email, "phone": u.phone,
        "is_verified": u.is_verified, "is_suspended": u.is_suspended,
        "member_type": u.profile.member_type if u.profile else "",
        "county": u.profile.county if u.profile else "",
        "roles": u.role_names(), "created_at": u.created_at,
    } for u in users]


@router.post("/members/{user_id}/verify")
def verify_member(user_id: str, request: Request, db: Session = Depends(get_db),
                  admin: User = Depends(require_permission("members.verify"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Member not found")
    u.is_verified = True
    db.commit()
    notify(db, u.id, "Your TSC membership has been verified", ntype="verification")
    log_action(db, admin.id, "member.verify", "user", user_id, request=request)
    return {"message": "Member verified"}


@router.post("/members/{user_id}/reject")
def reject_member(user_id: str, request: Request, db: Session = Depends(get_db),
                  admin: User = Depends(require_permission("members.verify"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Member not found")
    u.is_verified = False
    db.commit()
    notify(db, u.id, "Your verification was rejected. Please update your profile.",
           ntype="verification")
    log_action(db, admin.id, "member.reject", "user", user_id, request=request)
    return {"message": "Verification rejected"}


@router.post("/members/{user_id}/suspend")
def suspend_member(user_id: str, request: Request, db: Session = Depends(get_db),
                   admin: User = Depends(require_permission("members.suspend"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Member not found")
    u.is_suspended = True
    db.commit()
    log_action(db, admin.id, "member.suspend", "user", user_id, request=request)
    return {"message": "Member suspended"}


@router.post("/members/{user_id}/reactivate")
def reactivate_member(user_id: str, request: Request, db: Session = Depends(get_db),
                      admin: User = Depends(require_permission("members.suspend"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Member not found")
    u.is_suspended = False
    db.commit()
    log_action(db, admin.id, "member.reactivate", "user", user_id, request=request)
    return {"message": "Member reactivated"}


@router.put("/members/{user_id}/roles")
def assign_roles(user_id: str,
                 role_names: list[str] = Body(...),
                 request: Request = None,
                 db: Session = Depends(get_db),
                 admin: User = Depends(require_permission("members.assign_roles"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Member not found")

    # Safety: only the seeded super admin can grant/revoke SUPER_ADMIN
    if "SUPER_ADMIN" in (u.role_names() + role_names):
        if admin.email != settings.SUPER_ADMIN_EMAIL:
            raise HTTPException(403, "Only the platform owner can manage SUPER_ADMIN roles")

    roles = db.query(Role).filter(Role.name.in_(role_names)).all()
    u.roles = roles
    db.commit()
    log_action(db, admin.id, "member.assign_roles", "user", user_id,
               {"roles": role_names}, request=request)
    return {"message": "Roles updated", "roles": u.role_names()}


# ---------- ROLES & AUDIT ----------
@router.get("/roles")
def list_roles(db: Session = Depends(get_db),
               _: User = Depends(require_permission("roles.view"))):
    return [{"id": r.id, "name": r.name, "description": r.description,
             "permissions": [p.name for p in r.permissions]}
            for r in db.query(Role).all()]


@router.get("/audit-logs")
def audit_logs(limit: int = 100, db: Session = Depends(get_db),
               _: User = Depends(require_permission("audit.view"))):
    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [{"id": a.id, "actor_id": a.actor_id, "action": a.action,
             "target_type": a.target_type, "target_id": a.target_id,
             "ip_address": a.ip_address, "created_at": a.created_at} for a in rows]


# ---------- EVENT MANAGEMENT ----------
@router.post("/events")
def create_event(data: EventCreate, request: Request, db: Session = Depends(get_db),
                 admin: User = Depends(require_permission("events.manage"))):
    e = Event(**data.model_dump(), organizer_id=admin.id, status="draft")
    db.add(e)
    db.commit()
    log_action(db, admin.id, "event.create", "event", e.id, {"title": e.title},
               request=request)
    return {"id": e.id, "message": "Event created as draft"}


@router.get("/events")
def admin_events(db: Session = Depends(get_db),
                 _: User = Depends(require_permission("events.manage"))):
    events = db.query(Event).order_by(Event.starts_at.desc()).all()
    return [{
        "id": e.id, "title": e.title, "status": e.status,
        "starts_at": e.starts_at, "ends_at": e.ends_at,
        "location": getattr(e, "location", ""),
        "capacity": e.capacity,
        "registrations": _count(db, EventRegistration,
                                EventRegistration.event_id == e.id,
                                EventRegistration.status.in_(["registered", "attended"])),
        "attendance": _count(db, EventAttendance,
                             EventAttendance.event_id == e.id),
    } for e in events]


@router.post("/events/{event_id}/publish")
def publish_event(event_id: str, request: Request, db: Session = Depends(get_db),
                  admin: User = Depends(require_permission("events.manage"))):
    e = db.get(Event, event_id)
    if not e:
        raise HTTPException(404, "Event not found")
    e.status = "published"
    db.commit()
    log_action(db, admin.id, "event.publish", "event", event_id, request=request)
    return {"message": "Event published"}


@router.post("/events/{event_id}/cancel")
def cancel_event(event_id: str, request: Request, db: Session = Depends(get_db),
                 admin: User = Depends(require_permission("events.manage"))):
    e = db.get(Event, event_id)
    if not e:
        raise HTTPException(404, "Event not found")
    e.status = "cancelled"
    regs = db.query(EventRegistration).filter_by(event_id=event_id).all()
    for r in regs:
        notify(db, r.user_id, f"Event cancelled: {e.title}", ntype="event")
    db.commit()
    log_action(db, admin.id, "event.cancel", "event", event_id, request=request)
    return {"message": "Event cancelled"}


# =====================================================================
# SIDEBAR MODULE ENDPOINTS  (read-only)
# These back the generic <ModulePage /> in the admin app:
#   GET /api/admin/<module>/<sub-page>
# Anything NOT registered below still returns 404, and the frontend shows
# its "coming soon" placeholder. Keep this block at the END of the file.
# =====================================================================

_HIDDEN_COLUMNS = ("password", "hashed", "secret", "token")


def _model(name: str):
    """Look a model up by class name across the package and its modules."""
    for src in (models_pkg, _m_eco, _m_ev, _m_comm, _m_user, _m_admin):
        obj = getattr(src, name, None)
        if obj is not None and hasattr(obj, "__tablename__"):
            return obj
    return None


def _row(obj) -> dict:
    """Serialise every column of a SQLAlchemy object, minus sensitive ones."""
    out = {}
    for col in sa_inspect(obj).mapper.column_attrs:
        if any(h in col.key.lower() for h in _HIDDEN_COLUMNS):
            continue
        out[col.key] = getattr(obj, col.key)
    return out


def _list_endpoint(model_name: str, filters: dict):
    def endpoint(db: Session = Depends(get_db)):
        model = _model(model_name)
        if model is None:
            raise HTTPException(404, "Module not available yet")
        q = db.query(model)
        for col, val in filters.items():
            attr = getattr(model, col, None)
            if attr is None:
                raise HTTPException(404, "Module not available yet")
            q = q.filter(attr == val)
        created = getattr(model, "created_at", None)
        if created is not None:
            q = q.order_by(created.desc())
        return [_row(o) for o in q.limit(200).all()]
    return endpoint


def _admin_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.roles.any()).order_by(User.created_at.desc()).all()
    return [{
        "id": u.id, "full_name": u.full_name, "email": u.email,
        "roles": u.role_names(), "is_suspended": u.is_suspended,
        "created_at": u.created_at,
    } for u in users]


# ----- summary (key/value) endpoints -----
def _members_summary(db: Session = Depends(get_db)):
    return {
        "total": _count(db, User),
        "verified": _count(db, User, User.is_verified == True),  # noqa: E712
        "pending_verification": _count(db, User, User.is_verified == False),  # noqa: E712
        "suspended": _count(db, User, User.is_suspended == True),  # noqa: E712
    }


def _events_summary(db: Session = Depends(get_db)):
    return {
        "total": _count(db, Event),
        "draft": _count(db, Event, Event.status == "draft"),
        "published": _count(db, Event, Event.status == "published"),
        "cancelled": _count(db, Event, Event.status == "cancelled"),
        "registrations": _count(db, EventRegistration),
        "attendance": _count(db, EventAttendance),
    }


def _attendance_summary(db: Session = Depends(get_db)):
    regs = _count(db, EventRegistration)
    att = _count(db, EventAttendance)
    return {
        "registrations": regs,
        "attendance": att,
        "attendance_rate_percent": round(att / regs * 100, 1) if regs else 0,
    }


def _startups_summary(db: Session = Depends(get_db)):
    return {
        "total": _count(db, Startup),
        "pending_approval": _count(db, Startup, Startup.status == "pending"),
    }


def _projects_summary(db: Session = Depends(get_db)):
    return {
        "total": _count(db, Project),
        "pending_approval": _count(db, Project, Project.status == "pending"),
    }


def _hackathons_summary(db: Session = Depends(get_db)):
    return {"total": _count(db, Hackathon)}


def _chapters_summary(db: Session = Depends(get_db)):
    return {"total": _count(db, Chapter)}


def _engagement_summary(db: Session = Depends(get_db)):
    return {
        "posts": _count(db, Post),
        "event_registrations": _count(db, EventRegistration),
        "attendance": _count(db, EventAttendance),
    }


# ----- extra custom endpoints -----
def _hackathon_projects(db: Session = Depends(get_db)):
    from app.models.ecosystem import Project as P
    rows = (db.query(P).filter(P.hackathon_id.isnot(None))
            .order_by(P.created_at.desc()).limit(200).all())
    return [_row(o) for o in rows]


def _hackathon_results(db: Session = Depends(get_db)):
    """Leaderboard: weighted score % per project, across all judges."""
    from app.models.ecosystem import JudgingCriterion, JudgingScore, Project as P
    crit = {c.id: c for c in db.query(JudgingCriterion).all()}
    totals = {}
    for s in db.query(JudgingScore).all():
        c = crit.get(s.criterion_id)
        if not c:
            continue
        t = totals.setdefault(s.project_id, {"got": 0, "max": 0, "judges": set()})
        t["got"] += s.score * (c.weight or 1)
        t["max"] += (c.max_score or 10) * (c.weight or 1)
        t["judges"].add(s.judge_id)
    names = {p.id: p.name for p in db.query(P).filter(P.id.in_(list(totals) or [""])).all()}
    board = sorted(
        ({"project": names.get(pid, pid), "judges": len(t["judges"]),
          "score_percent": round(t["got"] / t["max"] * 100, 1) if t["max"] else 0}
         for pid, t in totals.items()),
        key=lambda r: r["score_percent"], reverse=True)
    return [{"rank": i + 1, **r} for i, r in enumerate(board)]


def _resource_categories(db: Session = Depends(get_db)):
    from app.models.ecosystem import Resource
    rows = db.query(Resource.category, func.count(Resource.id)).group_by(Resource.category).all()
    return [{"category": c, "resources": n} for c, n in rows]


# path -> (model name, {column: value} filters)
MODULE_LISTS = {
    # chapters
    "chapters/all-chapters": ("Chapter", {}),
    # events
    "events/create-event": ("Event", {"status": "draft"}),
    "events/registrations": ("EventRegistration", {}),
    "events/attendance": ("EventAttendance", {}),
    "events/qr-check-in": ("EventAttendance", {}),
    "events/mentors": ("Mentor", {}),
    # hackathons (challenges are shown from tracks)
    "hackathons/all-hackathons": ("Hackathon", {}),
    "hackathons/challenges": ("HackathonTrack", {}),
    "hackathons/participants": ("HackathonParticipant", {}),
    "hackathons/teams": ("Team", {}),
    "hackathons/judges": ("HackathonJudge", {}),
    "hackathons/criteria": ("JudgingCriterion", {}),
    "hackathons/scores": ("JudgingScore", {}),
    # projects
    "projects/all-projects": ("Project", {}),
    "projects/pending-approval": ("Project", {"status": "pending"}),
    "projects/featured": ("Project", {"is_featured": "1"}),
    "projects/showcase": ("Project", {"status": "approved"}),
    # startups
    "startups/all-startups": ("Startup", {}),
    "startups/pending-approval": ("Startup", {"status": "pending"}),
    "startups/featured": ("Startup", {"is_featured": "1"}),
    "startups/verification": ("Startup", {"status": "pending"}),
    # mentorship
    "mentorship/mentors": ("Mentor", {}),
    "mentorship/requests": ("MentorshipRequest", {}),
    "mentorship/active-mentorships": ("MentorshipRequest", {"status": "accepted"}),
    "mentorship/sessions": ("MentorshipSession", {}),
    # opportunities
    "opportunities/all": ("Opportunity", {}),
    "opportunities/jobs": ("Opportunity", {"type": "Job"}),
    "opportunities/grants": ("Opportunity", {"type": "Grant"}),
    "opportunities/internships": ("Opportunity", {"type": "Internship"}),
    "opportunities/competitions": ("Opportunity", {"type": "Competition"}),
    "opportunities/pending-approval": ("Opportunity", {"status": "pending"}),
    # resources
    "resources/all-resources": ("Resource", {}),
    "resources/pending-approval": ("Resource", {"status": "pending"}),
    # community / networking
    "community/posts": ("Post", {}),
    "community/comments": ("Comment", {}),
    "community/reports": ("ModerationReport", {}),
    "community/moderation": ("ModerationReport", {}),
    "networking/connections": ("Connection", {}),
    "networking/activity": ("Connection", {}),
    "networking/reports": ("ModerationReport", {}),
    # volunteers
    "volunteers/applications": ("VolunteerApplication", {}),
    "volunteers/volunteers": ("VolunteerApplication", {"status": "approved"}),
    "volunteers/history": ("VolunteerApplication", {}),
    # certificates / achievements
    "certificates/issued": ("Certificate", {}),
    "achievements/badges": ("Badge", {}),
    "achievements/member-achievements": ("UserBadge", {}),
    # incubation
    "incubation/programs": ("IncubationProgram", {}),
    "incubation/applications": ("IncubationApplication", {}),
    "incubation/milestones": ("IncubationMilestone", {}),
    # sponsors & partners  (sidebar slug is "sponsors-partners")
    "sponsors-partners/sponsors": ("Sponsor", {"partnership_type": "Sponsor"}),
    "sponsors-partners/partners": ("Sponsor", {"partnership_type": "Partner"}),
    "sponsors-partners/partnerships": ("Sponsor", {}),
    # communications
    "communications/notifications": ("Notification", {}),
    "communications/announcements": ("Notification", {"ntype": "announcement"}),
    # moderation
    "moderation/reports": ("ModerationReport", {}),
    "moderation/suspended-users": ("User", {"is_suspended": True}),
    # security
    "security/roles": ("Role", {}),
    "security/permissions": ("Permission", {}),
    "security/audit-logs": ("AuditLog", {}),
}

MODULE_CUSTOM = {
    "security/admin-users": _admin_users,
    "hackathons/projects": _hackathon_projects,
    "hackathons/results": _hackathon_results,
    "resources/categories": _resource_categories,
    "reports/members": _members_summary,
    "reports/events": _events_summary,
    "reports/attendance": _attendance_summary,
    "reports/startups": _startups_summary,
    "reports/hackathons": _hackathons_summary,
    "analytics/members": _members_summary,
    "analytics/events": _events_summary,
    "analytics/startups": _startups_summary,
    "analytics/projects": _projects_summary,
    "analytics/hackathons": _hackathons_summary,
    "analytics/chapters": _chapters_summary,
    "analytics/engagement": _engagement_summary,
    "events/event-reports": _events_summary,
}


def _perm_for(path: str) -> str:
    if path == "security/audit-logs":
        return "audit.view"
    return {
        "events": "events.manage",
        "hackathons": "hackathons.manage",
        "moderation": "moderation.manage",
        "community": "moderation.manage",
        "analytics": "analytics.view",
        "reports": "analytics.view",
        "security": "roles.view",
        "mentorship": "mentorship.manage",
        "incubation": "incubation.manage",
        "chapters": "chapters.manage",
        "volunteers": "volunteers.manage",
    }.get(path.split("/")[0], "admin.dashboard")


def _register_module_routes():
    for path, (model_name, filters) in MODULE_LISTS.items():
        router.add_api_route(
            f"/{path}", _list_endpoint(model_name, filters), methods=["GET"],
            dependencies=[Depends(require_permission(_perm_for(path)))],
            name=f"module_{path.replace('/', '_')}",
        )
    for path, fn in MODULE_CUSTOM.items():
        router.add_api_route(
            f"/{path}", fn, methods=["GET"],
            dependencies=[Depends(require_permission(_perm_for(path)))],
            name=f"module_{path.replace('/', '_')}",
        )


_register_module_routes()