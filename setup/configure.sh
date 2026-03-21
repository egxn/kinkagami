#!/usr/bin/env bash
set -euo pipefail

# ─── Kinkagami Configuration Wizard ─────────────────────────────────────────
# Generates src/config/defaultAppConfig.json based on user selections.
# Run: ./setup/configure.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/src/config/defaultAppConfig.json"

# ─── Helpers ─────────────────────────────────────────────────────────────────

BOLD='\033[1m'
CYAN='\033[0;36m'

ask() {

# --- Runtime (primero) ---
section "Runtime"
pick "Execution mode:" "workers" "workers" "site" "python"
RUNTIME_EXECUTION="$REPLY"

# --- Models ---
section "Pose Model"
pick "Pose detection model:" "movenet" "movenet" "blazepose"
POSE_MODEL="$REPLY"
if [ "$POSE_MODEL" = "movenet" ]; then
  pick "MoveNet variant:" "lightning" "lightning" "thunder"
  MOVENET_VERSION="$REPLY"
else
  MOVENET_VERSION="lightning"
fi
if [ "$POSE_MODEL" = "blazepose" ]; then
  pick "BlazePose variant:" "lite" "lite" "full" "heavy"
  BLAZEPOSE_VERSION="$REPLY"
else
  BLAZEPOSE_VERSION="lite"
fi
pick "HandPose variant:" "lite" "lite" "full"
HANDPOSE_VERSION="$REPLY"

# --- Camera ---
section "Camera"
pick "Camera source:" "web" "web" "streamUrl"
CAMERA_FLOW="$REPLY"
STREAM_URL="http://localhost:8090/?action=stream"
if [ "$CAMERA_FLOW" = "streamUrl" ]; then
  ask "Stream URL" "$STREAM_URL"
  STREAM_URL="$REPLY"
fi

# --- Backend sólo si no es python ---
if [ "$RUNTIME_EXECUTION" != "python" ]; then
  pick "TensorFlow backend:" "webgl" "webgl" "wasm"
  TF_BACKEND="$REPLY"
else
  TF_BACKEND="webgl"
fi

PYTHON_WS_URL="ws://127.0.0.1:8765"
PYTHON_STREAM_URL="http://localhost:8090/stream"
if [ "$RUNTIME_EXECUTION" = "python" ]; then
  ask "Python WebSocket URL" "$PYTHON_WS_URL"
  PYTHON_WS_URL="$REPLY"
  ask "Python MJPEG Stream URL" "$PYTHON_STREAM_URL"
  PYTHON_STREAM_URL="$REPLY"
fi
  local prompt="$1"
  local default="$2"
  echo -ne "  ${prompt} ${GREEN}[${default}]${RESET}: "
  read -r input
  REPLY="${input:-$default}"
}

# ─── Wizard Steps ────────────────────────────────────────────────────────────

banner

# --- Models ---
section "Pose Model"

pick "Pose detection model:" "movenet" "movenet" "blazepose"
POSE_MODEL="$REPLY"

if [ "$POSE_MODEL" = "movenet" ]; then
  pick "MoveNet variant:" "lightning" "lightning" "thunder"
  MOVENET_VERSION="$REPLY"
else
  MOVENET_VERSION="lightning"
fi

if [ "$POSE_MODEL" = "blazepose" ]; then
  pick "BlazePose variant:" "lite" "lite" "full" "heavy"
  BLAZEPOSE_VERSION="$REPLY"
else
  BLAZEPOSE_VERSION="lite"
fi

pick "HandPose variant:" "lite" "lite" "full"
HANDPOSE_VERSION="$REPLY"

# --- Camera ---
section "Camera"

pick "Camera source:" "web" "web" "streamUrl"
CAMERA_FLOW="$REPLY"

STREAM_URL="http://localhost:8090/?action=stream"
if [ "$CAMERA_FLOW" = "streamUrl" ]; then
  ask "Stream URL" "$STREAM_URL"
  STREAM_URL="$REPLY"
fi

# --- Runtime ---
section "Runtime"

pick "Execution mode:" "workers" "workers" "site" "python"
RUNTIME_EXECUTION="$REPLY"

pick "TensorFlow backend:" "webgl" "webgl" "wasm"
TF_BACKEND="$REPLY"

PYTHON_WS_URL="ws://127.0.0.1:8765"
PYTHON_STREAM_URL="http://localhost:8090/stream"
if [ "$RUNTIME_EXECUTION" = "python" ]; then
  ask "Python WebSocket URL" "$PYTHON_WS_URL"
  PYTHON_WS_URL="$REPLY"
  ask "Python MJPEG Stream URL" "$PYTHON_STREAM_URL"
  PYTHON_STREAM_URL="$REPLY"
fi

# --- Evaluation ---
section "Evaluation"

pick "Evaluation type:" "fsm" "fsm" "grid"
EVAL_TYPE="$REPLY"

# ─── Generate Config ─────────────────────────────────────────────────────────

section "Generating config"

cat > "$CONFIG_FILE" <<EOF
{
  "models": {
    "poseModel": "${POSE_MODEL}",
    "movenet": "${MOVENET_VERSION}",
    "blazepose": "${BLAZEPOSE_VERSION}",
    "handpose": "${HANDPOSE_VERSION}"
  },
  "camera": {
    "flow": "${CAMERA_FLOW}",
    "source": "${CAMERA_FLOW}",
    "streamUrl": "${STREAM_URL}"
  },
  "runtime": {
    "execution": "${RUNTIME_EXECUTION}",
    "backend": "${TF_BACKEND}",
    "pythonWebSocketUrl": "${PYTHON_WS_URL}",
    "pythonStreamUrl": "${PYTHON_STREAM_URL}"
  },
  "evaluation": {
    "type": "${EVAL_TYPE}"
  }
}
EOF

echo -e "  ${GREEN}Config written to:${RESET} ${CONFIG_FILE}"
echo ""
echo -e "  ${BOLD}Summary:${RESET}"
echo "    Pose model:    ${POSE_MODEL} (${MOVENET_VERSION}/${BLAZEPOSE_VERSION})"
echo "    HandPose:      ${HANDPOSE_VERSION}"
echo "    Camera:        ${CAMERA_FLOW}"
echo "    Execution:     ${RUNTIME_EXECUTION} (${TF_BACKEND})"
echo "    Evaluation:    ${EVAL_TYPE}"
echo ""
echo -e "  ${CYAN}Done. Run ${BOLD}pnpm dev${RESET}${CYAN} to start.${RESET}"
echo ""
