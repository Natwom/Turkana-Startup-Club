# schemas/auth.py
from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone: str = ""
    password: str = Field(min_length=8)
    location: str = ""
    county: str = "Turkana"
    institution: str = ""
    professional_role: str = ""
    member_type: str = "Tech enthusiast"
    experience_level: str = "Beginner"
    skills: list[str] = []
    interests: list[str] = []
    bio: str = ""
    linkedin: str = ""
    github: str = ""
    portfolio: str = ""
    startup_info: str = ""
    accept_terms: bool  # required: registration is rejected unless this is true

    @field_validator("accept_terms")
    @classmethod
    def must_accept_terms(cls, v: bool) -> bool:
        if v is not True:
            raise ValueError("You must accept the Terms and Conditions to register")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)