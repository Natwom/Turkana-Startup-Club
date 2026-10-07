from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import models as M
from app.api.deps import require_permission
from app.db.session import get_db
from app.services.audit import log_action

router = APIRouter(prefix="/api/admin/community", tags=["admin-community"])
PERM = "moderation.manage"


def _name(user) -> str:
    return user.full_name if user else ""


# ------------------------------------------------------------------ lists
@router.get("/posts")
def list_posts(db: Session = Depends(get_db),
               _: M.User = Depends(require_permission(PERM))):
    rows = db.query(M.Post).order_by(M.Post.created_at.desc()).limit(200).all()
    return [{
        "id": p.id,
        "author": _name(p.author),
        "type": p.post_type,
        "content": (p.content or "")[:140],
        "comments": len(p.comments),
        "likes": len(p.reactions),
        "hidden": p.is_hidden == "1",
        "created_at": p.created_at,
    } for p in rows]


@router.get("/comments")
def list_comments(db: Session = Depends(get_db),
                  _: M.User = Depends(require_permission(PERM))):
    rows = db.query(M.Comment).order_by(M.Comment.created_at.desc()).limit(200).all()
    return [{
        "id": c.id,
        "author": _name(c.author),
        "content": (c.content or "")[:140],
        "hidden": c.is_hidden == "1",
        "created_at": c.created_at,
    } for c in rows]


def _report_rows(db: Session):
    rows = db.query(M.ModerationReport).all()
    rows.sort(key=lambda r: getattr(r, "created_at", None) or 0, reverse=True)
    users = {u.id: u.full_name for u in db.query(M.User).all()}
    return [{
        "id": r.id,
        "reporter": users.get(getattr(r, "reporter_id", None), ""),
        "target_type": getattr(r, "target_type", ""),
        "target_id": getattr(r, "target_id", ""),
        "reason": getattr(r, "reason", ""),
        "status": getattr(r, "status", ""),
        "created_at": getattr(r, "created_at", None),
    } for r in rows[:200]]


@router.get("/reports")
def list_reports(db: Session = Depends(get_db),
                 _: M.User = Depends(require_permission(PERM))):
    return _report_rows(db)


@router.get("/moderation")
def list_moderation(db: Session = Depends(get_db),
                    _: M.User = Depends(require_permission(PERM))):
    return _report_rows(db)


# ---------------------------------------------------------------- actions
def _register(kind: str, model_name: str):
    model = getattr(M, model_name)

    def make(action: str):
        def endpoint(item_id: str, request: Request,
                     db: Session = Depends(get_db),
                     admin: M.User = Depends(require_permission(PERM))):
            obj = db.get(model, item_id)
            if not obj:
                raise HTTPException(404, f"{model_name} not found")
            if action == "delete":
                db.delete(obj)
            else:
                obj.is_hidden = "1" if action == "hide" else "0"
            db.commit()
            log_action(db, admin.id, f"community.{kind}.{action}", model_name,
                       item_id, request=request)
            return {"message": f"{kind.title()} {action} done"}
        return endpoint

    for act in ("hide", "unhide", "delete"):
        router.add_api_route(f"/{kind}/{{item_id}}/{act}", make(act),
                             methods=["POST"], name=f"community_{kind}_{act}")


_register("posts", "Post")
_register("comments", "Comment")