#!/bin/bash
# ─────────────────────────────────────────────────────────
#  ATOffice Startup Script
#  Starts backend + frontend concurrently
# ─────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  ⛩  ATOffice — Art Transcendence AI"
echo "  ────────────────────────────────────"
echo ""

# Load .env if exists
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
  echo "  ✓ Environment loaded"
else
  cp .env.example .env 2>/dev/null
  echo "  ⚠  No .env found — using .env.example (demo mode)"
  echo "     Add your API keys to .env for full functionality"
fi

# Check Python
if ! command -v python3 &> /dev/null; then
  echo "  ✗ Python3 not found. Install it first."
  exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js not found. Install it first."
  exit 1
fi

# Install backend deps (only if not already installed)
if ! python3 -c "import fastapi" 2>/dev/null; then
  echo ""
  echo "  → Installing backend dependencies (first time)..."
  pip install fastapi uvicorn "aiohttp>=3.9" "pydantic<2" python-multipart --prefer-binary -q
else
  echo "  ✓ Backend dependencies already installed"
fi

# Install frontend deps (only if node_modules missing)
if [ ! -d "frontend/node_modules" ]; then
  echo "  → Installing frontend dependencies (first time)..."
  cd frontend && npm install --silent 2>/dev/null && cd ..
else
  echo "  ✓ Frontend dependencies already installed"
fi

echo ""
echo "  🚀 Starting ATOffice..."
echo "  ─────────────────────────────────────────────"
echo "  Backend: http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  API Docs: http://localhost:8000/docs"
echo "  ─────────────────────────────────────────────"
echo ""

# Start backend in background
cd backend
python3 server.py &
BACKEND_PID=$!
cd ..

sleep 2

# Start frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "  ✓ Backend PID: $BACKEND_PID"
echo "  ✓ Frontend PID: $FRONTEND_PID"
echo ""
echo "  Press Ctrl+C to stop both servers"
echo ""

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '  ATOffice stopped.'" EXIT

wait
