#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$SCRIPT_DIR/backend"

if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "No .env found — copying .env.example. Fill in your Plaid keys before proceeding."
  cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
fi

if [ ! -d "$BACKEND/.venv" ]; then
  echo "Creating virtual environment…"
  python3 -m venv "$BACKEND/.venv"
fi

source "$BACKEND/.venv/bin/activate"
pip install -q -r "$BACKEND/requirements.txt"

echo ""
echo "  Finance Dashboard starting at http://localhost:8000"
echo "  Press Ctrl+C to stop."
echo ""

cd "$BACKEND"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
