import json
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Table, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.user import uid

role_permissions = Table(
    "role_permissions", Base.metadata,
    Column("role_id", String, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", String, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String(60), unique=True, index=True)  # SUPER_ADMIN, ADMIN, EVENT_MANAGER, ...
    description = Column(Text, default="")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    users = relationship("User", secondary="user_roles", back_populates="roles")


class Permission(Base):
    __tablename__ = "permissions"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String(100), unique=True, index=True)  # members.verify, events.manage, ...
    description = Column(Text, default="")
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True, default=uid)
    actor_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(120), nullable=False, index=True)   # member.verify, event.create...
    target_type = Column(String(60), default="")
    target_id = Column(String(64), default="")
    metadata_json = Column(Text, default="{}")
    ip_address = Column(String(60), default="")
    user_agent = Column(String(300), default="")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ModerationReport(Base):
    __tablename__ = "moderation_reports"
    id = Column(String, primary_key=True, default=uid)
    reporter_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    target_type = Column(String(30), nullable=False)  # post|comment|user
    target_id = Column(String(64), nullable=False, index=True)
    reason = Column(Text, default="")
    status = Column(String(20), default="open")  # open|dismissed|resolved
    created_at = Column(DateTime, default=datetime.utcnow)


class ModerationAction(Base):
    __tablename__ = "moderation_actions"
    id = Column(String, primary_key=True, default=uid)
    report_id = Column(String, ForeignKey("moderation_reports.id", ondelete="SET NULL"), nullable=True)
    moderator_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(60), nullable=False)  # dismiss|hide|remove|warn|suspend|ban
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class SystemSetting(Base):
    __tablename__ = "system_settings"
    key = Column(String(100), primary_key=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def decoded(self):
        try:
            return json.loads(self.value)
        except Exception:
            return self.value