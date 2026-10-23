from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import (Comment, ModerationReport, Post, Reaction, User)
from app.services.notifications import notify

router = APIRouter(prefix="/api/feed", tags=["feed"])

MAX_COMMENT = 1000


def _photo(u: User) -> str:
    return u.profile.photo_url if u and u.profile else ""


def _comment_out(c: Comment, me: User) -> dict:
    return {
        "id": c.id,
        "content": c.content,
        "author": c.author.full_name if c.author else "Former member",
        "author_id": c.author_id,
        "photo_url": _photo(c.author),
        "created_at": c.created_at,
        "mine": c.author_id == me.id,
    }


def _thread(p: Post, me: User) -> list[dict]:
    """Top-level comments, each with its replies nested under it (oldest first)."""
    visible = sorted((c for c in p.comments if c.is_hidden == "0"),
                     key=lambda c: c.created_at)
    tops, replies_by_parent = [], {}
    for c in visible:
        if c.parent_id:
            replies_by_parent.setdefault(c.parent_id, []).append(c)
        else:
            tops.append(c)
    out = []
    for t in tops:  # replies of a hidden/removed parent are never reached, so they stay hidden
        item = _comment_out(t, me)
        item["replies"] = [_comment_out(r, me) for r in replies_by_parent.get(t.id, [])]
        out.append(item)
    return out


@router.get("")
def feed(limit: int = 30, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    posts = db.query(Post).filter(Post.is_hidden == "0").order_by(Post.created_at.desc()).limit(limit).all()
    result = []
    for p in posts:
        comments = _thread(p, user)
        result.append({
            "id": p.id, "content": p.content, "post_type": p.post_type,
            "image_url": p.image_url, "created_at": p.created_at,
            "author": {"id": p.author.id, "name": p.author.full_name,
                       "photo": _photo(p.author), "photo_url": _photo(p.author)},
            "likes": len(p.reactions),
            "liked_by_me": any(r.user_id == user.id for r in p.reactions),
            "comments": comments,
            "comment_count": sum(1 + len(c["replies"]) for c in comments),
        })
    return result


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
def comment(post_id: str, content: str, parent_id: str = "",
            db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Add a comment, or a reply when parent_id (the comment being answered) is given."""
    text = content.strip()
    if not text:
        raise HTTPException(400, "Comment cannot be empty")
    if len(text) > MAX_COMMENT:
        raise HTTPException(400, f"Comment is too long (max {MAX_COMMENT} characters)")

    post = db.get(Post, post_id)
    if not post or post.is_hidden == "1":
        raise HTTPException(404, "Post not found")

    target = None
    thread_id = None
    if parent_id:
        target = db.get(Comment, parent_id)
        if not target or target.post_id != post_id or target.is_hidden == "1":
            raise HTTPException(404, "Comment not found")
        # replies are one level deep: answering a reply stays in the same thread
        thread_id = target.parent_id or target.id
        if thread_id != target.id:
            top = db.get(Comment, thread_id)
            if not top or top.is_hidden == "1":
                raise HTTPException(404, "Comment not found")

    c = Comment(post_id=post_id, author_id=user.id, content=text, parent_id=thread_id)
    db.add(c)
    db.commit()
    db.refresh(c)

    link = f"/community#post-{post_id}"
    preview = text if len(text) <= 120 else text[:117] + "..."
    if target is not None:
        if target.author_id != user.id:
            notify(db, target.author_id, f"{user.full_name} replied to your comment",
                   body=preview, ntype="community", link=link)
    elif post.author_id != user.id:
        notify(db, post.author_id, f"{user.full_name} commented on your post",
               body=preview, ntype="community", link=link)

    return {"id": c.id, "parent_id": thread_id}


@router.delete("/{post_id}/comments/{comment_id}")
def delete_comment(post_id: str, comment_id: str, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    c = db.get(Comment, comment_id)
    if not c or c.post_id != post_id:
        raise HTTPException(404, "Comment not found")
    if c.author_id != user.id and not {"SUPER_ADMIN", "ADMIN"} & set(user.role_names()):
        raise HTTPException(403, "Not allowed")
    db.delete(c)  # its replies are deleted with it
    db.commit()
    return {"message": "Comment deleted"}


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