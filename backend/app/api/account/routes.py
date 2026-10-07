from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models import MemberProfile, Skill, User
from app.services.audit import log_action
from app.services.notifications import email_sender
from app.services.storage import get_storage

router = APIRouter(prefix="/api/settings", tags=["settings"])

LEVELS = {"Beginner", "Intermediate", "Advanced"}
MAX_PHOTO_SIZE = 2 * 1024 * 1024  # 2 MB

PROFILE_TEXT_FIELDS = [
    "location", "county", "institution", "professional_role", "member_type",
    "experience_level", "bio", "linkedin", "github", "portfolio", "startup_info",
]


# ---------------------------------------------------------------- schemas
class SettingsUpdate(BaseModel):
    # account (users table)
    full_name: str | None = Field(None, max_length=200)
    phone: str | None = Field(None, max_length=30)
    # profile (member_profiles table)
    location: str | None = Field(None, max_length=150)
    county: str | None = Field(None, max_length=100)
    institution: str | None = Field(None, max_length=200)
    professional_role: str | None = Field(None, max_length=150)
    member_type: str | None = Field(None, max_length=60)
    experience_level: str | None = Field(None, max_length=40)
    bio: str | None = Field(None, max_length=2000)
    linkedin: str | None = Field(None, max_length=300)
    github: str | None = Field(None, max_length=300)
    portfolio: str | None = Field(None, max_length=300)
    startup_info: str | None = Field(None, max_length=2000)
    skills: list[str] | None = Field(None, max_length=30)
    interests: list[str] | None = Field(None, max_length=20)
    # privacy
    profile_public: bool | None = None

    @field_validator("full_name")
    @classmethod
    def name_ok(cls, v):
        if v is None:
            return v
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return v

    @field_validator("experience_level")
    @classmethod
    def level_ok(cls, v):
        if v and v not in LEVELS:
            raise ValueError("Experience level must be Beginner, Intermediate or Advanced")
        return v


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def bcrypt_limit(cls, v: str) -> str:
        # bcrypt only uses the first 72 BYTES, so reject anything longer
        if len(v.encode("utf-8")) > 72:
            raise ValueError("New password is too long (max 72 bytes)")
        return v


# ---------------------------------------------------------------- helpers
def _clean_list(items: list[str], max_len: int, lower: bool = False) -> list[str]:
    out, seen = [], set()
    for raw in items:
        item = (raw or "").strip()[:max_len]
        if lower:
            item = item.lower()
        if item and item.lower() not in seen:
            seen.add(item.lower())
            out.append(item)
    return out


def _serialize(user: User) -> dict:
    p = user.profile
    return {
        "email": user.email,
        "is_verified": bool(user.is_verified),
        "full_name": user.full_name,
        "phone": user.phone or "",
        "photo_url": p.photo_url if p else "",
        "location": p.location if p else "",
        "county": p.county if p else "",
        "institution": p.institution if p else "",
        "professional_role": p.professional_role if p else "",
        "member_type": p.member_type if p else "",
        "experience_level": p.experience_level if p else "Beginner",
        "bio": p.bio if p else "",
        "linkedin": p.linkedin if p else "",
        "github": p.github if p else "",
        "portfolio": p.portfolio if p else "",
        "startup_info": p.startup_info if p else "",
        "skills": [s.name for s in p.skills] if p else [],
        "interests": list(p.interests or []) if p else [],
        "profile_public": bool(p.profile_public) if p else True,
    }


def _ensure_profile(db: Session, user: User) -> MemberProfile:
    p = user.profile
    if p is None:
        p = MemberProfile(user_id=user.id)
        db.add(p)
        db.flush()
    return p


def _detect_image_ext(data: bytes) -> str | None:
    """Decide the file type from the bytes themselves, never from the client's filename."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


def _delete_local_upload(url: str | None) -> None:
    """Remove an old photo, but only if it is one of OUR uploaded files."""
    if not url or not (url.startswith("/api/uploads/") or url.startswith("/uploads/")):
        return
    folder = Path(settings.LOCAL_STORAGE_DIR).resolve()
    path = (folder / Path(url).name).resolve()   # Path(...).name strips any ../ tricks
    if path.parent == folder and path.is_file():
        try:
            path.unlink()
        except OSError:
            pass


# ---------------------------------------------------------------- profile settings
@router.get("")
def get_settings(user: User = Depends(get_current_user)):
    return _serialize(user)


@router.put("")
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    changes = data.model_dump(exclude_unset=True)

    if changes.get("full_name"):
        user.full_name = changes["full_name"]
    if "phone" in changes:
        user.phone = (changes["phone"] or "").strip()

    p = _ensure_profile(db, user)

    for field in PROFILE_TEXT_FIELDS:
        if field in changes:
            setattr(p, field, (changes[field] or "").strip())

    if "profile_public" in changes and changes["profile_public"] is not None:
        p.profile_public = changes["profile_public"]

    if "interests" in changes:
        p.interests = _clean_list(changes["interests"] or [], 60)

    if "skills" in changes:
        names = _clean_list(changes["skills"] or [], 100, lower=True)
        p.skills.clear()
        for name in names:
            skill = db.query(Skill).filter(Skill.name == name).first() or Skill(name=name)
            p.skills.append(skill)

    db.commit()
    db.refresh(user)
    return _serialize(user)


# ---------------------------------------------------------------- password
@router.post("/password")
def change_password(data: PasswordChange, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    # 400 (not 401) on purpose: the frontend treats 401 as "session expired" and logs you out
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    if data.new_password == data.current_password:
        raise HTTPException(400, "New password must be different from the current one")

    user.hashed_password = hash_password(data.new_password)
    db.commit()
    log_action(db, user.id, "account.change_password", "user", user.id, request=request)
    email_sender.send(user.email, "Your TSC password was changed",
                      "Your password was just changed. If this wasn't you, reset it immediately.")
    return {"message": "Password updated"}


# ---------------------------------------------------------------- photo
@router.post("/photo")
def upload_photo(file: UploadFile = File(...), db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    data = file.file.read(MAX_PHOTO_SIZE + 1)   # never read more than the limit + 1 byte
    if len(data) > MAX_PHOTO_SIZE:
        raise HTTPException(413, "Photo must be 2 MB or smaller")
    ext = _detect_image_ext(data)
    if not ext:
        raise HTTPException(400, "Please upload a PNG, JPG or WEBP image")

    try:
        stored = get_storage().save(data, ext)          # -> "/uploads/<uuid>.<ext>"
    except ValueError as e:
        raise HTTPException(400, str(e))

    # serve through /api/uploads so the existing /api dev proxy reaches it
    public_url = stored.replace("/uploads/", "/api/uploads/", 1)

    p = _ensure_profile(db, user)
    old = p.photo_url
    p.photo_url = public_url
    db.commit()
    _delete_local_upload(old)
    return {"photo_url": public_url}


@router.delete("/photo")
def remove_photo(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = _ensure_profile(db, user)
    old = p.photo_url
    p.photo_url = ""
    db.commit()
    _delete_local_upload(old)
    return {"photo_url": ""}