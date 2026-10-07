from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app import models  # noqa: F401  (registers all models)
from app.api.auth.routes import router as auth_router
from app.api.members.routes import router as members_router
from app.api.events.routes import router as events_router
from app.api.feed.routes import router as feed_router
from app.api.admin.routes import router as admin_router
from app.api.admin.manage import router as admin_manage_router
from app.api.admin.manage import public_router as certificates_public_router
from app.api.hackathons.routes import router as hackathons_router
from app.api.notifications.routes import router as notifications_router
from app.api.admin.community import router as admin_community_router
from app.api.messages.routes import router as messages_router
from app.api.account.routes import router as account_router

app = FastAPI(title="Turkana Startup Club API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(members_router)
app.include_router(messages_router)
app.include_router(account_router)
app.include_router(events_router)
app.include_router(feed_router)
app.include_router(admin_manage_router)      # must come BEFORE admin_router
app.include_router(admin_community_router)   # must come BEFORE admin_router
app.include_router(admin_router)
app.include_router(certificates_public_router)
app.include_router(hackathons_router)
app.include_router(notifications_router)

app.mount("/uploads", StaticFiles(directory=settings.LOCAL_STORAGE_DIR), name="uploads")
# same folder, reachable through the /api prefix (works with the Vite dev proxy)
app.mount("/api/uploads", StaticFiles(directory=settings.LOCAL_STORAGE_DIR), name="api-uploads")


DEFAULT_ROLES = {
    "SUPER_ADMIN": ["*"],
    "ADMIN": ["admin.dashboard", "members.view", "members.verify", "members.suspend",
              "members.assign_roles", "events.manage", "roles.view", "audit.view",
              "moderation.manage", "analytics.view",
              "certificates.manage", "hackathons.manage", "chapters.manage",
              "content.manage", "mentorship.manage", "incubation.manage",
              "volunteers.manage"],
    "EVENT_MANAGER": ["admin.dashboard", "events.manage"],
    "HACKATHON_MANAGER": ["admin.dashboard", "hackathons.manage"],
    "COMMUNITY_MODERATOR": ["moderation.manage"],
    "MENTORSHIP_MANAGER": ["mentorship.manage"],
    "INCUBATION_MANAGER": ["incubation.manage"],
    "CHAPTER_MANAGER": ["chapters.manage"],
    "CONTENT_MANAGER": ["content.manage"],
    "VOLUNTEER_MANAGER": ["volunteers.manage"],
    "JUDGE": ["hackathons.judge"],
    "MENTOR": ["mentorship.mentor"],
}


def seed():
    db = SessionLocal()
    try:
        from app.models import Permission, Role, User, MemberProfile, Chapter
        for role_name, perms in DEFAULT_ROLES.items():
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                role = Role(name=role_name)
                db.add(role)
                db.flush()
            for p in perms:
                perm = db.query(Permission).filter(Permission.name == p).first()
                if not perm:
                    perm = Permission(name=p)
                    db.add(perm)
                    db.flush()
                if perm not in role.permissions:
                    role.permissions.append(perm)
        for ch in ["TSC Lodwar", "TSC Turkana Central", "TSC Turkana South", "TSC Nairobi"]:
            if not db.query(Chapter).filter(Chapter.name == ch).first():
                db.add(Chapter(name=ch, slug=ch.lower().replace(" ", "-"),
                               location=ch.replace("TSC ", "")))
        if not db.query(User).filter(User.email == settings.SUPER_ADMIN_EMAIL).first():
            admin = User(email=settings.SUPER_ADMIN_EMAIL, full_name="TSC Super Admin",
                         hashed_password=hash_password(settings.SUPER_ADMIN_PASSWORD),
                         is_verified=True)
            sa = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
            admin.roles.append(sa)
            db.add(admin)
            db.flush()
            db.add(MemberProfile(user_id=admin.id, member_type="Other",
                                 professional_role="Platform Administrator", county="Turkana"))
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)   # dev mode; use Alembic in production
    seed()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "tsc-platform"}