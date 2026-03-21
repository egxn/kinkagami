#!/usr/bin/env bash
set -euo pipefail

# ─── Kinkagami — Dependency Installer (Debian/Ubuntu) ───────────────────────
# Checks for required programs and installs missing ones.
# Run with: sudo bash ./setup/install-deps.sh
#   (sudo only needed for apt packages)

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
NODE_VERSION="22"
PYTHON_VERSION="3.11"

ok()   { echo -e "  ${GREEN}✔${RESET} $1"; }
skip() { echo -e "  ${YELLOW}⏭${RESET} $1 (already installed)"; }
fail() { echo -e "  ${RED}✘${RESET} $1"; }
info() { echo -e "  ${CYAN}→${RESET} $1"; }

# ─── Ensure we can use apt ──────────────────────────────────────────────────

check_debian() {
  if ! command -v apt-get &>/dev/null; then
    fail "This script requires a Debian/Ubuntu system with apt-get."
    exit 1
  fi
}

# ─── apt packages ───────────────────────────────────────────────────────────

install_apt_packages() {
  echo ""
  echo -e "${BOLD}── System packages (apt) ──${RESET}"

  local packages=(
    curl
    git
    build-essential
    ffmpeg
    # OpenCV runtime deps
    libgl1
    libglib2.0-0
    # Python 3.11 build deps (for deadsnakes)
    software-properties-common
  )

  local to_install=()
  for pkg in "${packages[@]}"; do
    if dpkg -s "$pkg" &>/dev/null; then
      skip "$pkg"
    else
      to_install+=("$pkg")
    fi
  done

  if [ ${#to_install[@]} -gt 0 ]; then
    info "Installing: ${to_install[*]}"
    sudo apt-get update -qq
    sudo apt-get install -y -qq "${to_install[@]}"
    ok "System packages installed"
  fi
}

# ─── Python 3.11 ────────────────────────────────────────────────────────────

install_python() {
  echo ""
  echo -e "${BOLD}── Python ${PYTHON_VERSION} ──${RESET}"

  if command -v "python${PYTHON_VERSION}" &>/dev/null; then
    skip "python${PYTHON_VERSION} ($(python${PYTHON_VERSION} --version))"
    return
  fi

  info "Adding deadsnakes PPA and installing python${PYTHON_VERSION}..."
  sudo add-apt-repository -y ppa:deadsnakes/ppa
  sudo apt-get update -qq
  sudo apt-get install -y -qq \
    "python${PYTHON_VERSION}" \
    "python${PYTHON_VERSION}-venv" \
    "python${PYTHON_VERSION}-dev"
  ok "python${PYTHON_VERSION} installed ($(python${PYTHON_VERSION} --version))"
}

# ─── Poetry ─────────────────────────────────────────────────────────────────

install_poetry() {
  echo ""
  echo -e "${BOLD}── Poetry ──${RESET}"

  if command -v poetry &>/dev/null; then
    skip "poetry ($(poetry --version))"
    return
  fi

  info "Installing Poetry via official installer..."
  curl -sSL https://install.python-poetry.org | "python${PYTHON_VERSION}" -
  export PATH="$HOME/.local/bin:$PATH"

  if command -v poetry &>/dev/null; then
    ok "poetry installed ($(poetry --version))"
  else
    fail "Poetry installed but not on PATH. Add ~/.local/bin to your PATH."
    exit 1
  fi
}

# ─── nvm + Node ─────────────────────────────────────────────────────────────

install_nvm_node() {
  echo ""
  echo -e "${BOLD}── nvm + Node ${NODE_VERSION} ──${RESET}"

  if [ -s "$NVM_DIR/nvm.sh" ]; then
    skip "nvm"
  else
    info "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    ok "nvm installed"
  fi

  # Source nvm for the current shell
  export NVM_DIR="$NVM_DIR"
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

  if nvm ls "$NODE_VERSION" &>/dev/null; then
    skip "node ${NODE_VERSION} ($(node --version))"
  else
    info "Installing Node ${NODE_VERSION}..."
    nvm install "$NODE_VERSION"
    nvm alias default "$NODE_VERSION"
    ok "node $(node --version) installed"
  fi

  nvm use "$NODE_VERSION" &>/dev/null
}

# ─── pnpm ───────────────────────────────────────────────────────────────────

install_pnpm() {
  echo ""
  echo -e "${BOLD}── pnpm ──${RESET}"

  if command -v pnpm &>/dev/null; then
    skip "pnpm ($(pnpm --version))"
    return
  fi

  info "Installing pnpm via corepack..."
  corepack enable
  corepack prepare pnpm@latest --activate
  ok "pnpm installed ($(pnpm --version))"
}

# ─── Project dependencies ──────────────────────────────────────────────────

install_project_deps() {
  echo ""
  echo -e "${BOLD}── Project dependencies ──${RESET}"

  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

  info "Installing frontend (pnpm install)..."
  cd "$PROJECT_ROOT"
  pnpm install
  ok "Frontend dependencies installed"

  info "Installing backend (poetry install)..."
  cd "$PROJECT_ROOT/backend"
  poetry env use "python${PYTHON_VERSION}" 2>/dev/null || true
  poetry install
  ok "Backend dependencies installed"

  # mediapipe is optional in pyproject.toml because PyPI has no aarch64 wheel.
  # Try installing it inside the Poetry venv; on ARM64 this will fail silently.
  info "Installing mediapipe (optional, skipped on ARM64)..."
  if poetry run pip install mediapipe 2>/dev/null; then
    ok "mediapipe installed"
  else
    echo -e "  ${YELLOW}⏭${RESET} mediapipe not available for $(uname -m) — skipped"
  fi

  cd "$PROJECT_ROOT"
}

# ─── Summary ────────────────────────────────────────────────────────────────

summary() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}║  ${BOLD}All dependencies ready${RESET}${CYAN}                   ║${RESET}"
  echo -e "${CYAN}╚══════════════════════════════════════════╝${RESET}"
  echo ""
  echo -e "  python:  $(python${PYTHON_VERSION} --version 2>&1)"
  echo -e "  poetry:  $(poetry --version 2>&1)"
  echo -e "  node:    $(node --version 2>&1)"
  echo -e "  pnpm:    $(pnpm --version 2>&1)"
  echo -e "  ffmpeg:  $(ffmpeg -version 2>&1 | head -1)"
  echo ""
  echo -e "  Next steps:"
  echo -e "    ${BOLD}./setup/configure.sh${RESET}          # Configure the app"
  echo -e "    ${BOLD}pnpm dev:python${RESET}               # Run with Python backend"
  echo ""
}

# ─── Main ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}║  ${BOLD}Kinkagami Dependency Installer${RESET}${CYAN}          ║${RESET}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${RESET}"

check_debian
install_apt_packages
install_python
install_poetry
install_nvm_node
install_pnpm
install_project_deps
summary
