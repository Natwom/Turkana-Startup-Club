# services/audit.py
from fastapi import Request
from sqlalchemy.orm import Session
from app.models import AuditLog


def log_action(db: Session, actor_id: str | None, action: str,
               target_type: str = "", target_id: str = "",
               metadata: dict | None = None, request: Request | None = None) -> None:
    db.add(AuditLog(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata_json=__import__("json").dumps(metadata or {}),
        ip_address=request.client.host if request and request.client else "",
        user_agent=request.headers.get("user-agent", "") if request else "",
    ))
    db.commit()