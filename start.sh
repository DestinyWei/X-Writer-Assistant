#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== X Writer Assistant ==="

# Backend
echo "[1/2] 启动后端 (port 8000)..."
cd "$ROOT/backend"
if [ ! -d "../.venv" ]; then
  echo "  创建 Python 虚拟环境..."
  python3 -m venv "$ROOT/.venv"
fi
source "$ROOT/.venv/bin/activate"
pip install -q -r "$ROOT/backend/requirements.txt"
cd "$ROOT"
uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

# Frontend
echo "[2/2] 启动前端 (port 5173)..."
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "  安装前端依赖..."
  npm install
fi
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ 后端: http://localhost:8000"
echo "✓ 前端: http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
