# schemas/event.py
from datetime import datetime
from pydantic import BaseModel


class EventCreate(BaseModel):
    title: str
    description: str = ""
    event_type: str = "Networking Meetup"
    starts_at: datetime
    ends_at: datetime | None = None
    venue: str = ""
    location: str = ""
    directions: str = ""
    capacity: int = 100
    registration_deadline: datetime | None = None
    chapter_id: str | None = None


class EventOut(BaseModel):
    id: str
    title: str
    description: str
    event_type: str
    starts_at: datetime
    venue: str
    location: str
    capacity: int
    status: str

    class Config:
        from_attributes = True


class CheckInRequest(BaseModel):
    qr_token: str