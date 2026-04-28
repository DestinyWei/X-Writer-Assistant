import json
import logging
from backend.config import (
    ANTHROPIC_API_KEY, OPENAI_API_KEY, AI_PROVIDER,
    CLAUDE_MODEL, OPENAI_MODEL, OPENAI_BASE_URL,
)
from backend.models import StyleRule
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

TOPIC_TAGS = ["支付", "稳定币", "监管", "DeFi", "Layer2", "NFT", "交易所", "Web3", "AI", "融资", "合规", "安全", "跨境支付", "央行数字货币", "其他"]

ALLSCALE_STYLE_GUIDE = """AllScale 是一个专注于支付赛道的 Web3 项目，面向中文受众。
推文风格要求：
- 语气专业但不生硬，贴近行业从业者
- 信息密度适中，重点突出
- 末尾固定附带 #AllScale 话题标签
- 适当使用换行增强可读性
- 避免过度使用 Emoji，保持克制"""


def _chat(prompt: str, max_tokens: int = 2000) -> str:
    """统一调用入口，根据 AI_PROVIDER 自动选择"""
    if AI_PROVIDER == "anthropic":
        return _chat_anthropic(prompt, max_tokens)
    else:
        return _chat_openai(prompt, max_tokens)


def _chat_anthropic(prompt: str, max_tokens: int) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


def _chat_openai(prompt: str, max_tokens: int) -> str:
    from openai import OpenAI
    client = OpenAI(
        api_key=OPENAI_API_KEY or "openclaw",
        base_url=OPENAI_BASE_URL,
    )
    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.choices[0].message.content.strip()


def _parse_json(text: str):
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def _get_style_rules_prompt(db: Session) -> str:
    rules = db.query(StyleRule).filter(StyleRule.enabled == True).order_by(StyleRule.weight.desc()).limit(10).all()
    if not rules:
        return ""
    lines = ["\n以下是从历史编辑中学习到的排版和风格偏好规则，请务必遵守："]
    for r in rules:
        lines.append(f"- [{r.category}] {r.rule_text}")
        if r.examples:
            for ex in r.examples[:1]:
                lines.append(f"  示例: 「{ex.get('before', '')}」→「{ex.get('after', '')}」")
    return "\n".join(lines)


async def analyze_feed_items(items: list[dict]) -> list[dict]:
    if not items:
        return []

    items_text = "\n".join([
        f"{i+1}. 标题：{item['title']}\n   摘要：{item['summary'][:300]}"
        for i, item in enumerate(items)
    ])

    prompt = f"""你是一个加密货币/Web3 内容分析助手。请对以下文章进行主题分类和推荐评估。

可用标签：{', '.join(TOPIC_TAGS)}

文章列表：
{items_text}

请以 JSON 数组格式返回，每个元素包含：
- index: 文章序号（从1开始）
- tags: 主题标签数组（1-3个）
- reason: 推荐理由（1句话，说明这篇文章对 AllScale 中文官推的价值）
- relevance: 相关度评分（1-5，5最高）

只返回 JSON，不要其他文字。"""

    try:
        text = _chat(prompt, max_tokens=2000)
        return _parse_json(text)
    except Exception as e:
        logger.error(f"analyze_feed_items failed: {e}")
        return []


async def generate_drafts(
    post_type: str,
    post_format: str,
    title: str,
    summary: str,
    source_url: str,
    db: Session,
    selection_reasons: list[str] = None,
) -> list[dict]:
    style_rules = _get_style_rules_prompt(db)
    selection_context = ""
    if selection_reasons:
        selection_context = f"\n运营者选择这个选题的原因：{', '.join(selection_reasons)}"

    format_note = "推文（Twitter/X 帖子）" if post_format == "tweet" else "长文（X Article，支持多段落）"

    if post_type == "translate":
        task = f"""请将以下英文/中文文章改写为适合发布的中文推文草稿。

原文标题：{title}
原文摘要：{summary}
原文链接：{source_url}
发布格式：{format_note}
{selection_context}

{ALLSCALE_STYLE_GUIDE}
{style_rules}"""
    else:
        task = f"""请根据以下行业资讯，以 AllScale 的视角创作原创中文推文草稿。

资讯标题：{title}
资讯摘要：{summary}
参考链接：{source_url}
发布格式：{format_note}
{selection_context}

{ALLSCALE_STYLE_GUIDE}
{style_rules}"""

    prompt = f"""{task}

请生成 4 个风格不同的版本：
- 版本A：简洁直接型（信息密度高，语言精炼）
- 版本B：数据/观点强调型（突出关键数字或独到观点）
- 版本C：叙事背景型（提供更多背景，适合不熟悉行业的读者）
- 版本D：互动引导型（结尾引发思考或互动，如提问）

以 JSON 数组格式返回，每个元素包含：
- label: "A" / "B" / "C" / "D"
- style_note: 该版本的风格简述（10字以内）
- content: 推文正文（末尾必须包含 #AllScale）

只返回 JSON，不要其他文字。"""

    try:
        text = _chat(prompt, max_tokens=3000)
        return _parse_json(text)
    except Exception as e:
        logger.error(f"generate_drafts failed: {e}")
        return []


async def analyze_diff(original_draft: str, final_content: str) -> list[dict]:
    prompt = f"""请对比以下推文的初稿和最终发布版，逐条分析所有修改点。

【初稿】
{original_draft}

【最终发布稿】
{final_content}

请以 JSON 数组格式返回每处修改，每个元素包含：
- original: 初稿中被修改的原文（可以是短语或句子）
- modified: 最终稿中对应的内容
- category: 修改类型，从以下选择：语气调整 / 信息增减 / 本地化表达 / 品牌调性 / 排版习惯 / 标签话题
- analysis: 对这处修改的简短分析（说明为什么这样改更好）

如果两者几乎一致，返回空数组 []。
只返回 JSON，不要其他文字。"""

    try:
        text = _chat(prompt, max_tokens=2000)
        return _parse_json(text)
    except Exception as e:
        logger.error(f"analyze_diff failed: {e}")
        return []
