from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.user import uid


class ChatGroup(Base):
    __tablename__ = "chat_groups"

    id = Column(String, primary_key=True, default=uid)
    name = Column(String(100), nullable=False)
    description = Column(String(300), default="")
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("ChatGroupMember", back_populates="group",
                           cascade="all, delete-orphan")
    messages = relationship("ChatGroupMessage", back_populates="group",
                            cascade="all, delete-orphan")


class ChatGroupMember(Base):
    __tablename__ = "chat_group_members"
    __table_args__ = (UniqueConstraint("group_id", "user_id", name="uq_chat_group_user"),)

    id = Column(String, primary_key=True, default=uid)
    group_id = Column(String, ForeignKey("chat_groups.id", ondelete="CASCADE"),
                      nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    role = Column(String(20), default="member")               # "admin" | "member"
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_read_at = Column(DateTime, default=datetime.utcnow)  # drives unread counts

    group = relationship("ChatGroup", back_populates="members")
    user = relationship("User")


class ChatGroupMessage(Base):
    __tablename__ = "chat_group_messages"

    id = Column(String, primary_key=True, default=uid)
    group_id = Column(String, ForeignKey("chat_groups.id", ondelete="CASCADE"),
                      nullable=False, index=True)
    sender_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    group = relationship("ChatGroup", back_populates="messages")
    sender = relationship("User")