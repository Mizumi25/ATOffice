#!/bin/bash
# ─────────────────────────────────────────────────────────
#  ATOffice — Termux Startup
#  Optimized for Android/Termux environment
# ─────────────────────────────────────────────────────────

echo ""
echo "  ⛩  ATOffice — Termux Mode"
echo ""

# Termux package check
pkg_check() {
  if ! command -v "$1" &>/dev/null; then
    echo "  Installing $1..."
    pkg install "$1" -y
  fi
}

pkg_check python
pkg_check nodejs

# pip packages
pip install fastapi uvicorn aiohttp 2>/dev/null

# Load env
cd "$(dirname "$0")"
[ -f .env ] && export $(grep -v '^#' .env | xargs)

echo "  → Starting backend on :8000..."
cd backend && python server.py &
BPID=$!
cd ..

sleep 2

echo "  → Starting frontend on :3000..."
cd frontend && npm run dev &
FPID=$!
cd ..

echo ""
echo "  ✓ ATOffice running!"
echo "  Open browser: http://localhost:3000"
echo ""
echo "  Ctrl+C to stop"

trap "kill $BPID $FPID 2>/dev/null" EXIT
wait
