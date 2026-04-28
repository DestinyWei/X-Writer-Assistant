"""
run_backend.py — 本地 / 服务器启动入口

用法：
    python run_backend.py

可通过环境变量覆盖默认值：
    HOST=0.0.0.0  PORT=8000  RELOAD=true  python run_backend.py

注意：生产环境建议将 RELOAD 设为 false（默认已关闭）。
"""

import sys
import os
from pathlib import Path

# ── 路径自适应 ─────────────────────────────────────────────────────────────
# 使用脚本自身所在目录作为项目根，避免硬编码绝对路径，
# 保证项目迁移或多人协作时直接可用。
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(PROJECT_ROOT)

# ── 启动参数（支持环境变量覆盖）──────────────────────────────────────────────
HOST   = os.getenv("HOST",   "0.0.0.0")
PORT   = int(os.getenv("PORT",   "8000"))
RELOAD = os.getenv("RELOAD", "false").lower() == "true"  # 生产环境保持 false

import uvicorn
uvicorn.run(
    "backend.main:app",
    host=HOST,
    port=PORT,
    reload=RELOAD,
    # 在 reload=False 时使用 asyncio 事件循环（兼容性更好）
    loop="asyncio",
    http="h11",
)
