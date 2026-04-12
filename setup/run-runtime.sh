#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-frontend}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_WS_PORT="${KGM_PYTHON_WS_PORT:-8765}"
PYTHON_WS_HOST="${KGM_PYTHON_WS_HOST:-127.0.0.1}"
PYTHON_WS_URL="${KGM_PYTHON_WS_URL:-ws://${PYTHON_WS_HOST}:${PYTHON_WS_PORT}}"
PYTHON_STREAM_PORT="${KGM_STREAM_PORT:-8090}"
PYTHON_STREAM_URL="${KGM_PYTHON_STREAM_URL:-http://${PYTHON_WS_HOST}:${PYTHON_STREAM_PORT}/stream}"
WAIT_TIMEOUT="${KGM_WAIT_TIMEOUT:-30}"

cd "$ROOT_DIR"

case "$MODE" in
  frontend)
    export VITE_KGM_RUNTIME_EXECUTION="workers"
    exec pnpm run dev
    ;;
  python)
    export VITE_KGM_RUNTIME_EXECUTION="python"
    export VITE_KGM_PYTHON_WS_URL="$PYTHON_WS_URL"
    export VITE_KGM_PYTHON_STREAM_URL="$PYTHON_STREAM_URL"

    # Start the Python backend in the background
    # PYTHONPATH includes system site-packages so packages like mediapipe
    # installed via pip3 (e.g. on ARM64) are visible inside the Poetry venv.
    SYSTEM_SITE_PKGS="$(python3 -c 'import site; print(":".join(site.getsitepackages()))' 2>/dev/null || true)"
    cd backend && PYTHONPATH="${SYSTEM_SITE_PKGS}" poetry run kgm-camera-backend \
      --host "${PYTHON_WS_HOST}" \
      --port "${PYTHON_WS_PORT}" \
      --stream-port "${PYTHON_STREAM_PORT}" &
    BACKEND_PID=$!
    cd "$ROOT_DIR"

    # Wait for WebSocket port to be ready before starting the frontend
    bash "$SCRIPT_DIR/wait-for-port.sh" "$PYTHON_WS_HOST" "$PYTHON_WS_PORT" "$WAIT_TIMEOUT"

    # Start the frontend in the foreground
    pnpm run dev &
    FRONTEND_PID=$!

    # Clean up both processes on exit
    trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; wait' EXIT INT TERM
    wait
    ;;
  *)
    echo "Usage: $0 [frontend|python]" >&2
    exit 1
    ;;
esac
