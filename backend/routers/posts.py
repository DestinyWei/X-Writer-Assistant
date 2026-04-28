from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Post, FeedItem, DiffRecord, StyleRule
from backend.services.claude_service import generate_drafts, analyze_diff
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import logging

router = APIRouter(prefix="/posts", tags=["posts"])
logger = logging.getLogger(__name__)


class GenerateDraftsRequest(BaseModel):
    feed_item_id: Optional[int] = None
    post_type: str  # "translate" | "original"
    post_format: str = "tweet"  # "tweet" | "article"
    selection_reasons: list[str] = []


class SelectDraftRequest(BaseModel):
    draft_index: int
    reason_tags: list[str] = []
    reason_custom: Optional[str] = None


class UpdatePostRequest(BaseModel):
    final_content: Optional[str] = None
    scheduled_at: Optional[str] = None
    status: Optional[str] = None


class ConfirmDiffRequest(BaseModel):
    confirmed_diffs: list[dict]  # [{original, modified, category, analysis, confirmed: bool}]


@router.post("/generate")
async def generate_post_drafts(body: GenerateDraftsRequest, db: Session = Depends(get_db)):
    title, summary, url = "", "", ""
    if body.feed_item_id:
        feed_item = db.query(FeedItem).filter(FeedItem.id == body.feed_item_id).first()
        if not feed_item:
            raise HTTPException(status_code=404, detail="Feed item not found")
        title = feed_item.title
        summary = feed_item.summary or ""
        url = feed_item.url

    drafts = await generate_drafts(
        post_type=body.post_type,
        post_format=body.post_format,
        title=title,
        summary=summary,
        source_url=url,
        db=db,
        selection_reasons=body.selection_reasons,
    )

    post = Post(
        feed_item_id=body.feed_item_id,
        post_type=body.post_type,
        post_format=body.post_format,
        drafts=drafts,
        status="draft",
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _serialize(post)


@router.get("")
def list_posts(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(Post)
    if status:
        q = q.filter(Post.status == status)
    total = q.count()
    posts = q.order_by(Post.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "posts": [_serialize(p) for p in posts]}


@router.get("/{post_id}")
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _serialize(post)


@router.post("/{post_id}/select-draft")
def select_draft(post_id: int, body: SelectDraftRequest, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    drafts = post.drafts or []
    if body.draft_index < 0 or body.draft_index >= len(drafts):
        raise HTTPException(status_code=400, detail="Invalid draft index")

    post.selected_draft_index = body.draft_index
    post.draft_selection_reason_tags = body.reason_tags
    post.draft_selection_reason_custom = body.reason_custom
    post.final_content = drafts[body.draft_index]["content"]
    db.commit()
    db.refresh(post)
    return _serialize(post)


@router.put("/{post_id}")
def update_post(post_id: int, body: UpdatePostRequest, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if body.final_content is not None:
        post.final_content = body.final_content
    if body.status is not None:
        post.status = body.status
    if body.scheduled_at is not None:
        try:
            post.scheduled_at = datetime.fromisoformat(body.scheduled_at)
            post.status = "scheduled"
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid datetime format")

    db.commit()
    db.refresh(post)
    return _serialize(post)


@router.post("/{post_id}/publish")
async def publish_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not post.final_content:
        raise HTTPException(status_code=400, detail="No final content to publish")

    # Phase 1a: copy-to-clipboard only (no X API yet)
    post.status = "published"
    post.published_at = datetime.utcnow()
    db.commit()
    db.refresh(post)

    # Trigger diff analysis in background
    _trigger_diff_analysis(post_id, db)

    return {"message": "已标记为发布", "post": _serialize(post)}


@router.get("/{post_id}/diff")
def get_diff(post_id: int, db: Session = Depends(get_db)):
    record = db.query(DiffRecord).filter(DiffRecord.post_id == post_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Diff record not found yet")
    return {
        "id": record.id,
        "post_id": record.post_id,
        "original_draft": record.original_draft,
        "final_content": record.final_content,
        "diff": record.diff_json or [],
        "confirmed": record.confirmed,
    }


@router.post("/{post_id}/diff/confirm")
def confirm_diff(post_id: int, body: ConfirmDiffRequest, db: Session = Depends(get_db)):
    """运营者确认 diff 分析，将规则存入偏好库"""
    record = db.query(DiffRecord).filter(DiffRecord.post_id == post_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Diff record not found")

    for diff_item in body.confirmed_diffs:
        if not diff_item.get("confirmed", True):
            continue
        rule = StyleRule(
            category=diff_item.get("category", "其他"),
            rule_text=diff_item.get("analysis", ""),
            examples=[{
                "before": diff_item.get("original", ""),
                "after": diff_item.get("modified", ""),
            }],
            enabled=True,
            weight=1.0,
        )
        db.add(rule)

    record.confirmed = True
    record.diff_json = body.confirmed_diffs
    db.commit()
    return {"message": "规则已保存"}


def _trigger_diff_analysis(post_id: int, db: Session):
    """同步触发 diff 分析（简化版，实际可改为后台任务）"""
    import asyncio
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post or not post.drafts or post.selected_draft_index is None:
        return

    original = post.drafts[post.selected_draft_index]["content"]
    final = post.final_content

    async def _run():
        from backend.database import SessionLocal
        db2 = SessionLocal()
        try:
            diffs = await analyze_diff(original, final)
            record = DiffRecord(
                post_id=post_id,
                original_draft=original,
                final_content=final,
                diff_json=diffs,
                confirmed=False,
            )
            db2.add(record)
            db2.commit()
        except Exception as e:
            logger.error(f"Diff analysis failed: {e}")
        finally:
            db2.close()

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(_run())
        else:
            loop.run_until_complete(_run())
    except Exception as e:
        logger.error(f"Failed to run diff analysis: {e}")


def _serialize(post: Post) -> dict:
    return {
        "id": post.id,
        "feed_item_id": post.feed_item_id,
        "post_type": post.post_type,
        "post_format": post.post_format,
        "drafts": post.drafts or [],
        "selected_draft_index": post.selected_draft_index,
        "draft_selection_reason_tags": post.draft_selection_reason_tags or [],
        "draft_selection_reason_custom": post.draft_selection_reason_custom,
        "final_content": post.final_content,
        "status": post.status,
        "scheduled_at": post.scheduled_at.isoformat() if post.scheduled_at else None,
        "published_at": post.published_at.isoformat() if post.published_at else None,
        "created_at": post.created_at.isoformat() if post.created_at else None,
    }
