from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import (Comment, ModerationReport, Post, Reaction, User)

router = APIRouter(prefix="/api/feed", tags=["feed"])


@router.get("")
def feed(limit: int = 30, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    posts = db.query(Post).filter(Post.is_hidden == "0").order_by(Post.created_at.desc()).limit(limit).all()
    return [{
        "id": p.id, "content": p.content, "post_type": p.post_type,
        "image_url": p.image_url, "created_at": p.created_at,
        "author": {"id": p.author.id, "name": p.author.full_name,
                   "photo": p.author.profile.photo_url if p.author.profile else ""},
        "likes": len(p.reactions),
        "liked_by_me": any(r.user_id == user.id for r in p.reactions),
        "comments": [{"id": c.id, "content": c.content, "author": c.author.full_name,
                      "created_at": c.created_at}
                     for c in p.comments if c.is_hidden == "0"],
    } for p in posts]


@router.post("")
def create_post(content: str, post_type: str = "post", image_url: str = "",
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = Post(author_id=user.id, content=content, post_type=post_type, image_url=image_url)
    db.add(p)
    db.commit()
    return {"id": p.id}


@router.post("/{post_id}/like")
def like(post_id: str, emoji: str = "like", db: Session = Depends(get_db),
         user: User = Depends(get_current_user)):
    existing = db.query(Reaction).filter_by(post_id=post_id, user_id=user.id, emoji=emoji).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"liked": False}
    db.add(Reaction(post_id=post_id, user_id=user.id, emoji=emoji))
    db.commit()
    return {"liked": True}


@router.post("/{post_id}/comments")
def comment(post_id: str, content: str, db: Session = Depends(get_db),
            user: User = Depends(get_current_user)):
    c = Comment(post_id=post_id, author_id=user.id, content=content)
    db.add(c)
    db.commit()
    return {"id": c.id}


@router.delete("/{post_id}")
def delete_post(post_id: str, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(404, "Post not found")
    if p.author_id != user.id and not {"SUPER_ADMIN", "ADMIN"} & set(user.role_names()):
        raise HTTPException(403, "Not allowed")
    db.delete(p)
    db.commit()
    return {"message": "Post deleted"}


@router.post("/report")
def report(target_type: str, target_id: str, reason: str = "",
           db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.add(ModerationReport(reporter_id=user.id, target_type=target_type,
                            target_id=target_id, reason=reason))
    db.commit()
    return {"message": "Report submitted"}