# X-Writer-Assistant

AllScale 官推（@allscale_zh）半自动推文写作助手。

通过 RSS 聚合行业资讯 → AI 分类推荐 → 人工选题 → AI 生成多版本草稿 → 人工编辑确认 → 周历排期 → 发布，并在发布后自动学习编辑差异、沉淀排版风格规则。

---

## 功能概览

| 模块 | 说明 |
|------|------|
| 选题池 | 聚合多家中英文媒体 RSS，AI 自动打标签、评分，支持关键词搜索与话题筛选 |
| 草稿工坊 | 一键生成 4 种风格草稿（简洁 / 数据强调 / 背景叙事 / 互动引导），支持翻译改写与原创两种模式 |
| 周历排期 | 可视化一周发布计划，拖拽排期（规划中） |
| 风格学习 | 比对初稿与最终发布稿的差异，自动提炼排版习惯规则，下次生成时自动注入提示词 |

---

## 项目结构

```
X-Writer-Assistant/
├── backend/
│   ├── main.py              # FastAPI 应用入口，注册路由、启动定时任务
│   ├── config.py            # 环境变量读取、RSS 源列表、模型配置
│   ├── models.py            # SQLAlchemy ORM 模型（FeedItem / Post / StyleRule …）
│   ├── database.py          # SQLite 数据库连接
│   ├── routers/
│   │   ├── feeds.py         # /feeds — RSS 聚合、搜索、选题标记
│   │   ├── posts.py         # /posts — 草稿生成、编辑、发布、diff 触发
│   │   └── schedule.py      # /schedule — 周历、风格规则管理
│   └── services/
│       └── claude_service.py  # AI 调用（Anthropic / OpenAI 双模式）
├── frontend/
│   ├── src/
│   │   ├── pages/           # FeedPool / Workshop / Schedule / Rules
│   │   ├── api/client.ts    # 统一 fetch 封装 + TypeScript 类型定义
│   │   └── main.tsx
│   └── index.html
├── run_backend.py           # 后端启动脚本（路径自适应 + 环境变量支持）
├── start.sh                 # 一键启动前后端（本地开发用）
├── .env                     # 本地密钥（不进 git）
└── docs/
    └── CODE_REVIEW.md       # 代码审查清单（P0/P1/P2 待办）
```

---

## 环境变量

在项目根目录新建 `.env` 文件（参考以下模板）：

```dotenv
# ── AI 提供商 ────────────────────────────────────────────────
# 二选一：有 ANTHROPIC_API_KEY 自动用 Claude，否则用 OpenAI
ANTHROPIC_API_KEY=sk-ant-...          # 从 console.anthropic.com 获取

# OPENAI_API_KEY=sk-proj-...          # 备用：OpenAI 标准 API Key
# OPENAI_MODEL=gpt-4o                 # 默认 gpt-4o
# OPENAI_BASE_URL=https://api.openai.com/v1  # 兼容第三方网关时修改

# ── 服务器启动（可选）────────────────────────────────────────
# HOST=0.0.0.0
# PORT=8000
# RELOAD=false   # 开发时设为 true 启用热重载，生产保持 false
```

---

## 本地开发

### 前提

- Python 3.11+
- Node.js 18+

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/DestinyWei/X-Writer-Assistant.git
cd X-Writer-Assistant

# 2. 安装后端依赖
pip install -r requirements.txt

# 3. 安装前端依赖
cd frontend && npm install && cd ..

# 4. 配置 .env（见上方模板）

# 5. 启动后端（默认 http://localhost:8000）
python run_backend.py

# 6. 启动前端（新开终端，默认 http://localhost:5173）
cd frontend && npm run dev
```

也可以用一键脚本（需先 `chmod +x start.sh`）：

```bash
./start.sh
```

---

## 服务器部署

### 后端（systemd 服务）

```ini
# /etc/systemd/system/xwriter.service
[Unit]
Description=X-Writer-Assistant Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/opt/X-Writer-Assistant
EnvironmentFile=/opt/X-Writer-Assistant/.env
ExecStart=/opt/X-Writer-Assistant/venv/bin/python run_backend.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now xwriter
```

### 前端（Nginx 反向代理）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件（npm run build 产物）
    root /opt/X-Writer-Assistant/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 将 /feeds /posts /schedule 等 API 路径代理到后端
    location ~ ^/(feeds|posts|schedule) {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## API 速查

### Feeds（选题池）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/feeds` | 获取选题列表，支持 `topic` / `lang` / `used` / `q`（搜索） / `skip` / `limit` |
| POST | `/feeds/refresh` | 手动触发 RSS 抓取 + AI 分析 |
| GET | `/feeds/tags` | 获取所有已出现的话题标签 |
| POST | `/feeds/{id}/select` | 标记选题已选用，记录选择原因 |

### Posts（草稿与发布）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/posts/generate` | 根据选题生成 4 版草稿 |
| GET | `/posts` | 获取帖子列表，支持 `status` 筛选 |
| GET | `/posts/{id}` | 获取单条帖子详情 |
| POST | `/posts/{id}/select-draft` | 选定某版草稿，记录选择原因 |
| PUT | `/posts/{id}` | 更新最终内容 / 排期时间 / 状态 |
| POST | `/posts/{id}/publish` | 标记发布（暂为手动确认，X API 接入后自动发布） |
| GET | `/posts/{id}/diff` | 获取初稿 vs 最终稿差异分析 |
| POST | `/posts/{id}/diff/confirm` | 确认差异条目，触发风格规则入库 |

### Schedule（排期与风格规则）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/schedule/week` | 获取本周发布计划，支持 `week_start` 参数 |
| GET | `/schedule/rules` | 获取所有风格规则 |
| PUT | `/schedule/rules/{id}` | 更新风格规则（启用/禁用/权重） |
| DELETE | `/schedule/rules/{id}` | 删除风格规则 |

---

## 技术栈

**后端**：FastAPI · SQLAlchemy · SQLite · APScheduler · feedparser · Anthropic SDK / OpenAI SDK

**前端**：React 18 · TypeScript · Vite · Tailwind CSS · TanStack Query · React Router

---

## 待办 / 已知问题

详见 [`docs/CODE_REVIEW.md`](docs/CODE_REVIEW.md)。
