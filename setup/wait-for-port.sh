#!/usr/bin/env bash
# Wait until a TCP port is accepting connections.
# Usage: wait-for-port.sh HOST PORT [TIMEOUT_SECONDS]
set -euo pipefail

HOST="${1:?Usage: wait-for-port.sh HOST PORT [TIMEOUT]}"
PORT="${2:?Usage: wait-for-port.sh HOST PORT [TIMEOUT]}"
TIMEOUT="${3:-30}"

BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

elapsed=0
echo -e "${CYAN}Waiting for ${BOLD}${HOST}:${PORT}${RESET}${CYAN} (timeout: ${TIMEOUT}s)...${RESET}"
while ! (echo > /dev/tcp/"$HOST"/"$PORT") 2>/dev/null; do
  sleep 1
  elapsed=$((elapsed + 1))
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    echo -e "${RED}Timed out waiting for ${HOST}:${PORT} after ${TIMEOUT}s${RESET}" >&2
    exit 1
  fi
  echo -e "  ${YELLOW}Waiting... (${elapsed}s)${RESET}"
done
echo -e "${GREEN}${HOST}:${PORT} is up!${RESET}"
