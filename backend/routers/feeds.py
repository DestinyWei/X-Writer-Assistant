from fastapi import APIRouter, Depends, BackgroundTasks, Query
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import FeedItem
from backend.services.rss_service import fetch_all_feeds
from backend.services.claude_service import analyze_feed_items
from pydantic import BaseModel
from typing import Optional
import logging

router = APIRouter(prefix="/feeds", tags=["feeds"])
logger = logging.getLogger(__name__)


class SelectFeedRequest(BaseModel):
    reason_tags: list[str] = []
    reason_custom: Optional[str] = None


@router.get("")
def list_feeds(
    topic: Optional[str] = Query(None),
    used: Optional[bool] = Query(None),
    lang: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="关键词搜索，匹配标题和摘要"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(FeedItem)
    if topic:
        query = query.filter(FeedItem.topic_tags.contains(topic))
    if used is not None:
        query = query.filter(FeedItem.used == used)
    if lang:
        query = query.filter(FeedItem.source_lang == lang)
    if q:
        keyword = f"%{q}%"
        query = query.filter(
            FeedItem.title.ilike(keyword) | FeedItem.summary.ilike(keyword)
        )
    total = query.count()
    items = query.order_by(FeedItem.fetched_at.desc()).offset(skip).limit(limit).all()
    return {
        "total": total,
        "items": [_serialize(item) for item in items],
    }


@router.post("/refresh")
async def refresh_feeds(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """触发 RSS 抓取，在后台运行，立即返回"""
    background_tasks.add_task(_fetch_and_analyze, db)
    return {"message": "RSS 抓取已在后台启动"}


@router.post("/{feed_id}/select")
def select_feed(feed_id: int, body: SelectFeedRequest, db: Session = Depends(get_db)):
    item = db.query(FeedItem).filter(FeedItem.id == feed_id).first()
    if not item:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Feed item not found")
    item.selection_reason_tags = body.reason_tags
    item.selection_reason_custom = body.reason_custom
    item.used = True
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.get("/tags")
def list_tags(db: Session = Depends(get_db)):
    """返回所有出现过的主题标签"""
    items = db.query(FeedItem.topic_tags).all()
    tags = set()
    for (tag_list,) in items:
        if tag_list:
            tags.update(tag_list)
    return sorted(list(tags))


def _serialize(item: FeedItem) -> dict:
    return {
        "id": item.id,
        "source": item.source,
        "source_lang": item.source_lang,
        "title": item.title,
        "url": item.url,
        "summary": item.summary,
        "topic_tags": item.topic_tags or [],
        "recommendation_reason": item.recommendation_reason,
        "selection_reason_tags": item.selection_reason_tags or [],
        "selection_reason_custom": item.selection_reason_custom,
        "fetched_at": item.fetched_at.isoformat() if item.fetched_at else None,
        "published_at": item.published_at.isoformat() if item.published_at else None,
        "used": item.used,
    }


async def _fetch_and_analyze(db: Session):
    from backend.database import SessionLocal
    db2 = SessionLocal()
    try:
        result = await fetch_all_feeds(db2)
        logger.info(f"RSS fetch result: {result}")

        # Analyze untagged items
        untagged = db2.query(FeedItem).filter(
            FeedItem.topic_tags == None,
        ).order_by(FeedItem.fetched_at.desc()).limit(50).all()

        # Also include items with empty list
        untagged2 = [i for i in db2.query(FeedItem).order_by(FeedItem.fetched_at.desc()).limit(100).all()
                     if not i.topic_tags]
        all_untagged = {i.id: i for i in untagged + untagged2}.values()
        items_to_analyze = list(all_untagged)[:30]

        if items_to_analyze:
            analysis = await analyze_feed_items([
                {"title": i.title, "summary": i.summary or ""} for i in items_to_analyze
            ])
            for result_item in analysis:
                idx = result_item.get("index", 0) - 1
                if 0 <= idx < len(items_to_analyze):
                    db_item = items_to_analyze[idx]
                    db_item.topic_tags = result_item.get("tags", [])
                    db_item.recommendation_reason = result_item.get("reason", "")
            db2.commit()
    except Exception as e:
        logger.error(f"Background fetch/analyze failed: {e}")
    finally:
        db2.close()
