from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import (create_access_token, create_refresh_token, create_token,
                               decode_token, hash_password, verify_password)
from datetime import timedelta
from app.db.session import get_db
from app.models import (Chapter, MemberProfile, Skill, User)
from app.schemas.auth import (ForgotPasswordRequest, LoginRequest, RefreshRequest,
                              RegisterRequest, ResetPasswordRequest, TokenResponse)
from app.services.audit import log_action
from app.services.notifications import email_sender, notify

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _profile_dict(p: MemberProfile) -> dict:
    return {
        "location": p.location, "county": p.county, "institution": p.institution,
        "professional_role": p.professional_role, "member_type": p.member_type,
        "experience_level": p.experience_level, "bio": p.bio, "photo_url": p.photo_url,
        "linkedin": p.linkedin, "github": p.github, "portfolio": p.portfolio,
        "startup_info": p.startup_info, "interests": p.interests or [],
        "skills": [s.name for s in p.skills],
        "chapter": p.chapter.name if p.chapter else None,
        "profile_public": p.profile_public,
    }


def _user_out(u: User) -> dict:
    return {
        "id": u.id, "email": u.email, "full_name": u.full_name, "phone": u.phone,
        "is_verified": u.is_verified, "roles": u.role_names(),
        "profile": _profile_dict(u.profile) if u.profile else None,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(409, "Email already registered")

    user = User(email=data.email, full_name=data.full_name, phone=data.phone,
                hashed_password=hash_password(data.password))
    db.add(user)
    db.flush()

    profile = MemberProfile(
        user_id=user.id, location=data.location, county=data.county,
        institution=data.institution, professional_role=data.professional_role,
        member_type=data.member_type, experience_level=data.experience_level,
        bio=data.bio, linkedin=data.linkedin, github=data.github,
        portfolio=data.portfolio, startup_info=data.startup_info,
        interests=data.interests,
    )
    for name in data.skills:
        skill = db.query(Skill).filter(Skill.name == name.lower()).first() \
                 or Skill(name=name.lower())
        profile.skills.append(skill)
    db.add(profile)
    db.commit()

    verify_token = create_token(user.id, "verify", timedelta(hours=24))
    email_sender.send(data.email, "Verify your TSC account",
                      f"Click to verify: {settings.FRONTEND_URL}/verify-email?token={verify_token}")
    log_action(db, user.id, "auth.register", "user", user.id, request=request)
    return {"message": "Registration successful. Check your email to verify your account."}


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if user.is_suspended:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account suspended")
    log_action(db, user.id, "auth.login", "user", user.id, request=request)
    return TokenResponse(
        access_token=create_access_token(user.id, user.role_names()),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(data.refresh_token, "refresh")
    user = db.get(User, payload["sub"])
    if not user or user.is_suspended:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    return TokenResponse(
        access_token=create_access_token(user.id, user.role_names()),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    payload = decode_token(token, "verify")
    user = db.get(User, payload["sub"])
    if not user:
        raise HTTPException(404, "User not found")
    user.is_verified = True
    db.commit()
    log_action(db, user.id, "auth.verify_email", "user", user.id)
    return {"message": "Email verified. You can now log in."}


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if user:
        token = create_token(user.id, "reset", timedelta(hours=1))
        email_sender.send(user.email, "TSC password reset",
                          f"Reset link: {settings.FRONTEND_URL}/reset-password?token={token}")
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    payload = decode_token(data.token, "reset")
    user = db.get(User, payload["sub"])
    if not user:
        raise HTTPException(404, "User not found")
    user.hashed_password = hash_password(data.new_password)
    db.commit()
    log_action(db, user.id, "auth.reset_password", "user", user.id)
    return {"message": "Password updated."}


@router.get("/me")
def me(user: User = Depends(__import__("app.api.deps", fromlist=["get_current_user"]).get_current_user)):
    return _user_out(user)