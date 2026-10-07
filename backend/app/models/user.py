import uuid
from datetime import datetime

from sqlalchemy import (Column, String, Text, Boolean, DateTime, ForeignKey, Table, JSON)
from sqlalchemy.orm import relationship

from app.db.base import Base


def uid() -> str:
    return str(uuid.uuid4())


# FIX: user_id now references member_profiles.user_id (was users.id),
# so SQLAlchemy can join MemberProfile -> user_skills -> Skill.
user_skills = Table(
    "user_skills", Base.metadata,
    Column("user_id", String, ForeignKey("member_profiles.user_id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", String, ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
)

user_roles = Table(
    "user_roles", Base.metadata,
    Column("user_id", String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", String, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


class Skill(Base):
    __tablename__ = "skills"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String(100), unique=True, index=True)

    profiles = relationship("MemberProfile", secondary=user_skills, back_populates="skills")


class Chapter(Base):
    __tablename__ = "chapters"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String(150), unique=True)
    slug = Column(String(150), unique=True, index=True)
    description = Column(Text, default="")
    location = Column(String(150), default="")
    leader_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=uid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=False)
    phone = Column(String(30), default="")
    is_verified = Column(Boolean, default=False)
    is_suspended = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    profile = relationship("MemberProfile", back_populates="user",
                           uselist=False, cascade="all, delete-orphan")
    roles = relationship("Role", secondary=user_roles, back_populates="users")

    def role_names(self) -> list[str]:
        return [r.name for r in self.roles]


class MemberProfile(Base):
    __tablename__ = "member_profiles"
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    location = Column(String(150), default="")
    county = Column(String(100), default="Turkana")
    institution = Column(String(200), default="")
    professional_role = Column(String(150), default="")
    member_type = Column(String(60), default="Tech enthusiast")   # Student, Developer, Founder...
    experience_level = Column(String(40), default="Beginner")     # Beginner / Intermediate / Advanced
    bio = Column(Text, default="")
    photo_url = Column(String(500), default="")
    linkedin = Column(String(300), default="")
    github = Column(String(300), default="")
    portfolio = Column(String(300), default="")
    startup_info = Column(Text, default="")
    interests = Column(JSON, default=list)
    chapter_id = Column(String, ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    profile_public = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")
    chapter = relationship("Chapter")
    skills = relationship("Skill", secondary=user_skills, back_populates="profiles")