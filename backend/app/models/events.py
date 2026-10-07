from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.user import uid


class Event(Base):
    __tablename__ = "events"
    id = Column(String, primary_key=True, default=uid)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    cover_image = Column(String(500), default="")
    event_type = Column(String(60), default="Networking Meetup")
    starts_at = Column(DateTime, nullable=False, index=True)
    ends_at = Column(DateTime, nullable=True)
    venue = Column(String(200), default="")
    location = Column(String(150), default="")
    directions = Column(Text, default="")
    capacity = Column(Integer, default=100)
    registration_deadline = Column(DateTime, nullable=True)
    status = Column(String(20), default="draft")  # draft|published|cancelled|completed
    organizer_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    chapter_id = Column(String, ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class EventRegistration(Base):
    __tablename__ = "event_registrations"
    id = Column(String, primary_key=True, default=uid)
    registration_id = Column(String(30), unique=True, index=True)  # human ticket no, e.g. TSC-7F3K2
    event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    qr_token = Column(String(64), unique=True, index=True)
    status = Column(String(20), default="registered")  # registered|waitlist|cancelled
    checked_in_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    event = relationship("Event")
    user = relationship("User")


class EventAttendance(Base):
    __tablename__ = "event_attendance"
    id = Column(String, primary_key=True, default=uid)
    registration_id = Column(String, ForeignKey("event_registrations.id", ondelete="CASCADE"), unique=True)
    event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    check_in_time = Column(DateTime, default=datetime.utcnow)
    checked_in_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)