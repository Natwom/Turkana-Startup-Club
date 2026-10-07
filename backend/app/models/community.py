from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.user import uid


class Post(Base):
    __tablename__ = "posts"
    id = Column(String, primary_key=True, default=uid)
    author_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    post_type = Column(String(40), default="post")  # post|project|startup|question|opportunity
    content = Column(Text, nullable=False)
    image_url = Column(String(500), default="")
    is_hidden = Column(String(1), default="0")  # keep as string for sqlite/pg parity
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    author = relationship("User")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    reactions = relationship("Reaction", back_populates="post", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"
    id = Column(String, primary_key=True, default=uid)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    author_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    content = Column(Text, nullable=False)
    is_hidden = Column(String(1), default="0")
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="comments")
    author = relationship("User")


class Reaction(Base):
    __tablename__ = "reactions"
    __table_args__ = (UniqueConstraint("post_id", "user_id", "emoji", name="uq_reaction"),)
    id = Column(String, primary_key=True, default=uid)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    emoji = Column(String(20), default="like")
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="reactions")


class Connection(Base):
    __tablename__ = "connections"
    __table_args__ = (UniqueConstraint("requester_id", "addressee_id", name="uq_connection"),)
    id = Column(String, primary_key=True, default=uid)
    requester_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    addressee_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status = Column(String(20), default="pending")  # pending|accepted|rejected|removed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DirectMessage(Base):
    __tablename__ = "direct_messages"
    id = Column(String, primary_key=True, default=uid)
    sender_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)