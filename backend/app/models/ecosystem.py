from datetime import datetime
from sqlalchemy import (Column, String, Text, Integer, DateTime, ForeignKey, UniqueConstraint)
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.user import uid


# ---------- HACKATHONS ----------
class Hackathon(Base):
    __tablename__ = "hackathons"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=True)
    venue = Column(String(200), default="")
    status = Column(String(20), default="upcoming")  # upcoming|live|judging|completed|archived
    rules = Column(Text, default="")
    schedule = Column(Text, default="")
    event_id = Column(String, ForeignKey("events.id", ondelete="SET NULL"), nullable=True)


class HackathonTrack(Base):
    __tablename__ = "hackathon_tracks"
    id = Column(String, primary_key=True, default=uid)
    hackathon_id = Column(String, ForeignKey("hackathons.id", ondelete="CASCADE"), index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, default="")


class HackathonParticipant(Base):
    __tablename__ = "hackathon_participants"
    __table_args__ = (UniqueConstraint("hackathon_id", "user_id", name="uq_hack_participant"),)
    id = Column(String, primary_key=True, default=uid)
    hackathon_id = Column(String, ForeignKey("hackathons.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    checked_in = Column(String(1), default="0")
    created_at = Column(DateTime, default=datetime.utcnow)


class Team(Base):
    __tablename__ = "teams"
    id = Column(String, primary_key=True, default=uid)
    hackathon_id = Column(String, ForeignKey("hackathons.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(150), nullable=False)
    leader_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    description = Column(Text, default="")
    technologies = Column(String(300), default="")
    github = Column(String(300), default="")
    demo_url = Column(String(300), default="")
    track_id = Column(String, ForeignKey("hackathon_tracks.id", ondelete="SET NULL"), nullable=True)
    is_project_team = Column(String(1), default="0")  # year-round team outside hackathons
    created_at = Column(DateTime, default=datetime.utcnow)


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_member"),)
    id = Column(String, primary_key=True, default=uid)
    team_id = Column(String, ForeignKey("teams.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role = Column(String(60), default="member")
    status = Column(String(20), default="accepted")  # invited|accepted|declined|left


class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=uid)
    team_id = Column(String, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    hackathon_id = Column(String, ForeignKey("hackathons.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(200), nullable=False)
    tagline = Column(String(250), default="")
    problem = Column(Text, default="")
    solution = Column(Text, default="")
    technologies = Column(String(300), default="")
    screenshots = Column(String, default="[]")  # JSON list of urls
    demo_url = Column(String(300), default="")
    github = Column(String(300), default="")
    video_url = Column(String(300), default="")
    stage = Column(String(40), default="Idea")   # Idea|Prototype|MVP|Production|Startup
    category = Column(String(100), default="")
    status = Column(String(20), default="pending")  # pending|approved|rejected
    is_featured = Column(String(1), default="0")
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=datetime.utcnow)


class JudgingCriterion(Base):
    __tablename__ = "judging_criteria"
    id = Column(String, primary_key=True, default=uid)
    hackathon_id = Column(String, ForeignKey("hackathons.id", ondelete="CASCADE"), index=True)
    name = Column(String(150), nullable=False)   # Innovation, Impact, ...
    weight = Column(Integer, default=1)
    max_score = Column(Integer, default=10)


class JudgingScore(Base):
    __tablename__ = "judging_scores"
    __table_args__ = (UniqueConstraint("criterion_id", "project_id", "judge_id", name="uq_score"),)
    id = Column(String, primary_key=True, default=uid)
    criterion_id = Column(String, ForeignKey("judging_criteria.id", ondelete="CASCADE"), index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    judge_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    score = Column(Integer, nullable=False)
    comment = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class HackathonJudge(Base):
    __tablename__ = "hackathon_judges"
    __table_args__ = (UniqueConstraint("hackathon_id", "user_id", name="uq_judge"),)
    id = Column(String, primary_key=True, default=uid)
    hackathon_id = Column(String, ForeignKey("hackathons.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)


# ---------- STARTUPS ----------
class Startup(Base):
    __tablename__ = "startups"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String(200), nullable=False, index=True)
    logo_url = Column(String(500), default="")
    description = Column(Text, default="")
    problem = Column(Text, default="")
    solution = Column(Text, default="")
    industry = Column(String(120), default="")
    location = Column(String(150), default="")
    website = Column(String(300), default="")
    stage = Column(String(40), default="Idea")   # Idea|Pre-seed|Prototype|MVP|Early-stage|Growth
    funding_status = Column(String(120), default="")
    status = Column(String(20), default="pending")  # pending|verified|rejected
    is_featured = Column(String(1), default="0")
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=datetime.utcnow)


class StartupMember(Base):
    __tablename__ = "startup_members"
    __table_args__ = (UniqueConstraint("startup_id", "user_id", name="uq_startup_member"),)
    id = Column(String, primary_key=True, default=uid)
    startup_id = Column(String, ForeignKey("startups.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role = Column(String(100), default="Founder")


# ---------- MENTORSHIP ----------
class Mentor(Base):
    __tablename__ = "mentors"
    id = Column(String, primary_key=True, default=uid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    skills = Column(String(300), default="")
    expertise = Column(String(300), default="")
    industry = Column(String(150), default="")
    availability = Column(String(200), default="")
    areas = Column(String(400), default="")  # comma separated areas of mentorship
    is_active = Column(String(1), default="1")


class MentorshipRequest(Base):
    __tablename__ = "mentorship_requests"
    id = Column(String, primary_key=True, default=uid)
    mentor_id = Column(String, ForeignKey("mentors.id", ondelete="CASCADE"), index=True)
    mentee_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message = Column(Text, default="")
    status = Column(String(20), default="pending")  # pending|accepted|rejected
    created_at = Column(DateTime, default=datetime.utcnow)


class MentorshipSession(Base):
    __tablename__ = "mentorship_sessions"
    id = Column(String, primary_key=True, default=uid)
    request_id = Column(String, ForeignKey("mentorship_requests.id", ondelete="CASCADE"), index=True)
    scheduled_at = Column(DateTime, nullable=False)
    notes = Column(Text, default="")
    status = Column(String(20), default="scheduled")  # scheduled|completed|cancelled


# ---------- OPPORTUNITIES / RESOURCES / CERTIFICATES ----------
class Opportunity(Base):
    __tablename__ = "opportunities"
    id = Column(String, primary_key=True, default=uid)
    type = Column(String(60), default="Job")  # Grant|Job|Internship|Hackathon|Fellowship|...
    title = Column(String(200), nullable=False)
    organization = Column(String(200), default="")
    description = Column(Text, default="")
    location = Column(String(150), default="")
    link = Column(String(400), default="")
    deadline = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending")  # pending|approved|closed
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SavedOpportunity(Base):
    __tablename__ = "saved_opportunities"
    __table_args__ = (UniqueConstraint("user_id", "opportunity_id", name="uq_saved_opp"),)
    id = Column(String, primary_key=True, default=uid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    opportunity_id = Column(String, ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)


class Resource(Base):
    __tablename__ = "resources"
    id = Column(String, primary_key=True, default=uid)
    category = Column(String(100), default="Guide")  # Startup guides|Pitch decks|AI|...
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    file_url = Column(String(500), default="")
    external_url = Column(String(500), default="")
    status = Column(String(20), default="approved")


class Certificate(Base):
    __tablename__ = "certificates"
    id = Column(String, primary_key=True, default=uid)
    certificate_id = Column(String(40), unique=True, index=True)  # public verification code
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    activity_type = Column(String(60), default="event")  # event|hackathon|workshop|volunteer|...
    activity_id = Column(String, nullable=True)
    title = Column(String(250), nullable=False)  # e.g. "TSC Hackathon 2026 – Participant"
    issued_at = Column(DateTime, default=datetime.utcnow)


class Badge(Base):
    __tablename__ = "badges"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String(100), unique=True)
    description = Column(Text, default="")
    icon = Column(String(100), default="")


class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),)
    id = Column(String, primary_key=True, default=uid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    badge_id = Column(String, ForeignKey("badges.id", ondelete="CASCADE"), index=True)
    awarded_at = Column(DateTime, default=datetime.utcnow)


# ---------- INCUBATION / SPONSORS / NOTIFICATIONS / VOLUNTEERS ----------
class IncubationProgram(Base):
    __tablename__ = "incubation_programs"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    cohort_name = Column(String(100), default="")
    application_deadline = Column(DateTime, nullable=True)
    status = Column(String(20), default="open")  # open|closed|running|completed


class IncubationApplication(Base):
    __tablename__ = "incubation_applications"
    id = Column(String, primary_key=True, default=uid)
    program_id = Column(String, ForeignKey("incubation_programs.id", ondelete="CASCADE"), index=True)
    startup_id = Column(String, ForeignKey("startups.id", ondelete="CASCADE"), index=True)
    status = Column(String(20), default="submitted")  # submitted|shortlisted|accepted|rejected|graduated
    submitted_at = Column(DateTime, default=datetime.utcnow)


class IncubationMilestone(Base):
    __tablename__ = "incubation_milestones"
    id = Column(String, primary_key=True, default=uid)
    application_id = Column(String, ForeignKey("incubation_applications.id", ondelete="CASCADE"), index=True)
    title = Column(String(200), nullable=False)
    due_date = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending")  # pending|done|missed
    notes = Column(Text, default="")


class Sponsor(Base):
    __tablename__ = "sponsors"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String(200), nullable=False)
    logo_url = Column(String(500), default="")
    description = Column(Text, default="")
    website = Column(String(300), default="")
    contact_email = Column(String(255), default="")
    partnership_type = Column(String(100), default="Partner")  # Sponsor|Partner|...
    status = Column(String(20), default="pending")  # pending|approved


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=uid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String(200), nullable=False)
    body = Column(Text, default="")
    ntype = Column(String(40), default="general")
    link = Column(String(400), default="")
    is_read = Column(String(1), default="0")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class VolunteerApplication(Base):
    __tablename__ = "volunteer_applications"
    id = Column(String, primary_key=True, default=uid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role = Column(String(100), default="")  # Registration, Photography, Logistics...
    message = Column(Text, default="")
    status = Column(String(20), default="pending")  # pending|approved|rejected
    created_at = Column(DateTime, default=datetime.utcnow)