import os
from dotenv import load_dotenv

load_dotenv(override=True)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# AI_PROVIDER: "anthropic" | "openai"
# 不填时自动判断：有 ANTHROPIC_API_KEY 用 anthropic，否则用 openai
AI_PROVIDER = os.getenv("AI_PROVIDER", "anthropic" if ANTHROPIC_API_KEY else "openai")

RSS_FEEDS = [
    # 中文媒体
    {"name": "BlockBeats 律动", "url": "https://api.theblockbeats.news/v2/rss/article", "lang": "zh"},
    {"name": "BlockBeats 律动快讯", "url": "https://api.theblockbeats.news/v2/rss/newsflash", "lang": "zh"},
    {"name": "PANews", "url": "https://www.panewslab.com/zh/rss", "lang": "zh"},
    {"name": "TechFlow", "url": "https://techflowpost.mirror.xyz/feed/atom", "lang": "zh"},
    {"name": "ChainCatcher", "url": "https://www.chaincatcher.com/rss", "lang": "zh"},
    # 英文媒体
    {"name": "The Block", "url": "https://www.theblock.co/rss.xml", "lang": "en"},
    {"name": "CoinDesk", "url": "https://www.coindesk.com/arc/outboundfeeds/rss/", "lang": "en"},
    {"name": "Cointelegraph", "url": "https://cointelegraph.com/rss", "lang": "en"},
    {"name": "Decrypt", "url": "https://decrypt.co/feed", "lang": "en"},
]

FETCH_INTERVAL_HOURS = 6

CLAUDE_MODEL = "claude-sonnet-4-6"
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
# 自定义 base URL，接 OpenClaw 本地网关时填 http://127.0.0.1:18789/v1
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
