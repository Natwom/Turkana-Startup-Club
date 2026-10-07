# schemas/member.py
from pydantic import BaseModel


class ProfileUpdate(BaseModel):
    location: str | None = None
    county: str | None = None
    institution: str | None = None
    professional_role: str | None = None
    member_type: str | None = None
    experience_level: str | None = None
    bio: str | None = None
    photo_url: str | None = None
    linkedin: str | None = None
    github: str | None = None
    portfolio: str | None = None
    startup_info: str | None = None
    interests: list[str] | None = None
    skills: list[str] | None = None
    profile_public: bool | None = None