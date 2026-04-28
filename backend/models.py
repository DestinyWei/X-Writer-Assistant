from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, Float
from sqlalchemy.sql import func
from backend.database import Base


class FeedItem(Base):
    __tablename__ = "feed_items"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(100), nullable=False)
    source_lang = Column(String(10), default="en")
    title = Column(Text, nullable=False)
    url = Column(Text, unique=True, nullable=False)
    summary = Column(Text)
    topic_tags = Column(JSON, default=list)       # ["支付", "稳定币"]
    recommendation_reason = Column(Text)           # Claude 推荐理由
    selection_reason_tags = Column(JSON, default=list)
    selection_reason_custom = Column(Text)
    fetched_at = Column(DateTime, server_default=func.now())
    published_at = Column(DateTime)
    used = Column(Boolean, default=False)


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    feed_item_id = Column(Integer, nullable=True)  # null = 纯原创
    post_type = Column(String(20), nullable=False)  # "translate" | "original"
    post_format = Column(String(20), default="tweet")  # "tweet" | "article"
    drafts = Column(JSON, default=list)             # [{label, content, style_note}, ...]
    selected_draft_index = Column(Integer, nullable=True)
    draft_selection_reason_tags = Column(JSON, default=list)
    draft_selection_reason_custom = Column(Text)
    final_content = Column(Text)
    status = Column(String(20), default="draft")   # draft|scheduled|published|archived
    scheduled_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class DiffRecord(Base):
    __tablename__ = "diff_records"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, nullable=False)
    original_draft = Column(Text)
    final_content = Column(Text)
    diff_json = Column(JSON)                       # [{original, modified, type, analysis}, ...]
    confirmed = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class StyleRule(Base):
    __tablename__ = "style_rules"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50))  # 语气/信息/本地化/品牌/排版/标签
    rule_text = Column(Text)
    examples = Column(JSON, default=list)          # [{before, after}, ...]
    enabled = Column(Boolean, default=True)
    weight = Column(Float, default=1.0)
    created_at = Column(DateTime, server_default=func.now())
