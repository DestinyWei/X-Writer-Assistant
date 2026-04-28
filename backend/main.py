from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager
import logging

from backend.database import init_db, SessionLocal
from backend.routers import feeds, posts, schedule
from backend.config import FETCH_INTERVAL_HOURS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def scheduled_rss_fetch():
    from backend.services.rss_service import fetch_all_feeds
    from backend.services.claude_service import analyze_feed_items
    from backend.models import FeedItem

    db = SessionLocal()
    try:
        result = await fetch_all_feeds(db)
        logger.info(f"Scheduled RSS fetch: {result}")

        untagged = [i for i in db.query(FeedItem).order_by(FeedItem.fetched_at.desc()).limit(100).all()
                    if not i.topic_tags][:30]
        if untagged:
            analysis = await analyze_feed_items([
                {"title": i.title, "summary": i.summary or ""} for i in untagged
            ])
            for r in analysis:
                idx = r.get("index", 0) - 1
                if 0 <= idx < len(untagged):
                    untagged[idx].topic_tags = r.get("tags", [])
                    untagged[idx].recommendation_reason = r.get("reason", "")
            db.commit()
    except Exception as e:
        logger.error(f"Scheduled RSS fetch failed: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler.add_job(scheduled_rss_fetch, "interval", hours=FETCH_INTERVAL_HOURS, id="rss_fetch")
    scheduler.start()
    logger.info(f"Scheduler started, RSS fetch every {FETCH_INTERVAL_HOURS}h")
    yield
    scheduler.shutdown()


app = FastAPI(title="X Writer Assistant", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(feeds.router)
app.include_router(posts.router)
app.include_router(schedule.router)


@app.get("/health")
def health():
    return {"status": "ok"}
