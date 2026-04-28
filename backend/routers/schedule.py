from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Post
from datetime import datetime, timedelta

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("/week")
def get_week_schedule(
    week_start: str = None,
    db: Session = Depends(get_db),
):
    """返回指定周（默认本周）的所有排期和已发布帖子"""
    if week_start:
        try:
            start = datetime.fromisoformat(week_start)
        except ValueError:
            start = _this_monday()
    else:
        start = _this_monday()

    end = start + timedelta(days=7)

    posts = db.query(Post).filter(
        Post.status.in_(["scheduled", "published"]),
        Post.scheduled_at >= start,
        Post.scheduled_at < end,
    ).order_by(Post.scheduled_at).all()

    # Build day-by-day structure
    days = {}
    for i in range(7):
        day = start + timedelta(days=i)
        days[day.strftime("%Y-%m-%d")] = []

    for post in posts:
        day_key = post.scheduled_at.strftime("%Y-%m-%d")
        if day_key in days:
            days[day_key].append(_serialize_compact(post))

    return {
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "days": days,
    }


@router.get("/rules")
def list_style_rules(db: Session = Depends(get_db)):
    from backend.models import StyleRule
    rules = db.query(StyleRule).order_by(StyleRule.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "category": r.category,
            "rule_text": r.rule_text,
            "examples": r.examples or [],
            "enabled": r.enabled,
            "weight": r.weight,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rules
    ]


@router.put("/rules/{rule_id}")
def update_style_rule(rule_id: int, body: dict, db: Session = Depends(get_db)):
    from backend.models import StyleRule
    rule = db.query(StyleRule).filter(StyleRule.id == rule_id).first()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Rule not found")
    if "enabled" in body:
        rule.enabled = body["enabled"]
    if "weight" in body:
        rule.weight = body["weight"]
    if "rule_text" in body:
        rule.rule_text = body["rule_text"]
    db.commit()
    return {"message": "updated"}


@router.delete("/rules/{rule_id}")
def delete_style_rule(rule_id: int, db: Session = Depends(get_db)):
    from backend.models import StyleRule
    rule = db.query(StyleRule).filter(StyleRule.id == rule_id).first()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"message": "deleted"}


def _this_monday() -> datetime:
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    return today - timedelta(days=today.weekday())


def _serialize_compact(post: Post) -> dict:
    preview = (post.final_content or "")[:80]
    return {
        "id": post.id,
        "post_type": post.post_type,
        "post_format": post.post_format,
        "preview": preview,
        "status": post.status,
        "scheduled_at": post.scheduled_at.isoformat() if post.scheduled_at else None,
        "published_at": post.published_at.isoformat() if post.published_at else None,
    }
