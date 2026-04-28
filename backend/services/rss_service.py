import feedparser
import httpx
from datetime import datetime
from sqlalchemy.orm import Session
from backend.models import FeedItem
from backend.config import RSS_FEEDS
import logging

logger = logging.getLogger(__name__)


def _parse_date(entry) -> "datetime | None":
    for attr in ("published_parsed", "updated_parsed"):
        val = getattr(entry, attr, None)
        if val:
            try:
                return datetime(*val[:6])
            except Exception:
                pass
    return None


def _get_summary(entry) -> str:
    for attr in ("summary", "description", "content"):
        val = getattr(entry, attr, None)
        if isinstance(val, list) and val:
            val = val[0].get("value", "")
        if val:
            # Strip basic HTML tags
            import re
            clean = re.sub(r"<[^>]+>", "", str(val))
            return clean[:800].strip()
    return ""


async def fetch_all_feeds(db: Session) -> dict:
    results = {"fetched": 0, "new": 0, "errors": []}

    for feed_config in RSS_FEEDS:
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(feed_config["url"])
                resp.raise_for_status()
                raw = resp.text
        except Exception as e:
            logger.warning(f"Failed to fetch {feed_config['name']}: {e}")
            results["errors"].append({"source": feed_config["name"], "error": str(e)})
            continue

        parsed = feedparser.parse(raw)
        for entry in parsed.entries[:30]:
            url = getattr(entry, "link", None)
            if not url:
                continue

            results["fetched"] += 1
            existing = db.query(FeedItem).filter(FeedItem.url == url).first()
            if existing:
                continue

            title = getattr(entry, "title", "").strip()
            summary = _get_summary(entry)
            published_at = _parse_date(entry)

            item = FeedItem(
                source=feed_config["name"],
                source_lang=feed_config["lang"],
                title=title,
                url=url,
                summary=summary,
                topic_tags=[],
                published_at=published_at,
            )
            db.add(item)
            results["new"] += 1

    db.commit()
    return results
