# 代码审查清单

> 创建于 2026-04-28，持续更新。
> 标记说明：✅ 已修复 · 🔴 P0（阻断功能）· 🟡 P1（影响体验）· 🔵 P2（优化建议）

---

## 🔴 P0 — 必须尽快修复

### 1. `posts.py` — 异步触发使用已废弃 API

**位置**：`backend/routers/posts.py`，`_trigger_diff_analysis()` 函数

**问题**：
```python
# 当前写法（Python 3.10+ 已废弃，3.12 将报 DeprecationWarning）
loop = asyncio.get_event_loop()
loop.run_until_complete(...)
```

**影响**：在 Python 3.12 环境下会触发警告甚至崩溃；在已有事件循环的上下文（如 FastAPI 请求处理中）调用会直接抛 `RuntimeError`。

**修复方案**：
```python
import asyncio, threading

def _trigger_diff_analysis(post_id: int, original: str, final: str):
    """在独立线程里创建新事件循环运行异步任务，避免与 FastAPI 主循环冲突。"""
    def _run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_do_diff(post_id, original, final))
        finally:
            loop.close()
    threading.Thread(target=_run, daemon=True).start()
```

---

### 2. `claude_service.py` — AI 报错被静默吞掉

**位置**：`backend/services/claude_service.py`，所有 `except` 块

**问题**：
```python
except Exception as e:
    logger.error(f"generate_drafts failed: {e}")
    return []   # 返回空列表，调用方无感知
```

**影响**：API Key 无效、余额不足、网络超时等致命错误对用户完全透明——前端只看到"0 个草稿"，没有任何报错提示，极难排查。

**修复方案**：将异常向上抛出，由路由层统一返回 HTTP 500，前端 Toast 展示错误原因：
```python
# claude_service.py：移除 try/except，让异常自然冒泡
text = _chat(prompt, max_tokens=3000)
return _parse_json(text)

# posts.py 路由层：统一捕获
try:
    drafts = await generate_drafts(...)
except Exception as e:
    raise HTTPException(status_code=500, detail=f"AI 生成失败：{e}")
```

---

## 🟡 P1 — 近期处理

### 3. `feeds.py` — SQLite JSON contains 查询可靠性

**位置**：`backend/routers/feeds.py`，话题标签过滤

**问题**：用 `FeedItem.topic_tags.contains(topic)` 做 JSON 字段的字符串 contains 匹配，可能出现误匹配（如搜索"AI"匹配到"AILayer2"）。

**修复方案**：改用 SQLite JSON 函数或在 Python 层过滤：
```python
# 方案 A：Python 层精确过滤（数据量小时够用）
items = [i for i in items if topic in (i.topic_tags or [])]

# 方案 B：改用 JSON_EACH 子查询（数据量大时推荐）
```

---

### 4. `tailwind-output.css` 被 git 追踪

**位置**：`frontend/src/tailwind-output.css`

**问题**：编译产物进入版本库，每次样式变更都会产生大量无意义 diff，也容易出现本地编译版本与仓库不一致。

**修复方案**：
1. 在 `.gitignore` 中添加 `frontend/src/tailwind-output.css`
2. 在 `package.json` 的 `prebuild` / `predev` 钩子中自动编译：
   ```json
   "scripts": {
     "prebuild": "tailwindcss -i ./src/index.css -o ./src/tailwind-output.css --minify",
     "predev": "tailwindcss -i ./src/index.css -o ./src/tailwind-output.css"
   }
   ```

---

### 5. `FeedPool.tsx` — 搜索无防抖

**位置**：`frontend/src/pages/FeedPool.tsx`，搜索输入框

**问题**：每次按键都触发一次 API 请求，输入"稳定币"会发出 3 次请求。

**修复方案**：
```typescript
import { useDebouncedValue } from '@mantine/hooks' // 或自行实现
const [debouncedKeyword] = useDebouncedValue(searchKeyword, 300)

// queryKey 和 queryFn 改用 debouncedKeyword
```

---

### 6. `start.sh` — venv 路径硬假设

**位置**：`start.sh`

**问题**：脚本假设存在 `venv/bin/python`，若用户用 conda、pyenv 或全局 Python 则直接报错。

**修复方案**：
```bash
PYTHON=${VIRTUAL_ENV:+$VIRTUAL_ENV/bin/python}
PYTHON=${PYTHON:-$(which python3)}
echo "Using Python: $PYTHON"
$PYTHON run_backend.py &
```

---

## 🔵 P2 — 优化建议

### 7. SQLite 未开启 WAL 模式

**位置**：`backend/database.py`

**问题**：默认 Journal 模式在并发读写时容易锁表，RSS 抓取（后台写）与用户请求（读）会相互阻塞。

**修复方案**：
```python
from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_wal_mode(dbapi_conn, _):
    dbapi_conn.execute("PRAGMA journal_mode=WAL")
    dbapi_conn.execute("PRAGMA synchronous=NORMAL")
```

---

### 8. 列表接口缺乏分页

**位置**：`/feeds`、`/posts`

**问题**：随着数据积累，一次性返回所有记录会导致响应变慢。

**修复方案**：前端已传 `skip` / `limit`，后端确认 SQLAlchemy 查询加上 `.offset(skip).limit(limit)` 并在响应中返回 `total`（已部分实现，需全面检查）。

---

### 9. CORS 生产环境未限域

**位置**：`backend/main.py`

**问题**：`allow_origins=["*"]` 在生产环境存在安全风险。

**修复方案**：通过环境变量注入允许的域名：
```python
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, ...)
```

---

### 10. AI 调用无超时设置

**位置**：`backend/services/claude_service.py`，`_chat_anthropic()` / `_chat_openai()`

**问题**：无超时限制时，网络抖动可能导致请求永久挂起，阻塞 FastAPI worker。

**修复方案**：
```python
# Anthropic
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY, timeout=30.0)

# OpenAI
client = OpenAI(api_key=..., timeout=30.0)
```
