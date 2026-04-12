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

# ─── Python 3.11 via pyenv ──────────────────────────────────────────────────

PYENV_ROOT="${PYENV_ROOT:-$HOME/.pyenv}"

_ensure_pyenv_in_path() {
  export PYENV_ROOT="$PYENV_ROOT"
  export PATH="$PYENV_ROOT/bin:$PATH"
  eval "$(pyenv init -)"
}

install_python() {
  echo ""
  echo -e "${BOLD}── Python ${PYTHON_VERSION} (pyenv) ──${RESET}"

  # Install pyenv if missing
  if [ ! -d "$PYENV_ROOT" ]; then
    info "Installing pyenv..."
    curl -fsSL https://pyenv.run | bash
    ok "pyenv installed"
  else
    skip "pyenv"
  fi

  _ensure_pyenv_in_path

  # Install Python version if missing
  if pyenv versions --bare | grep -qF "${PYTHON_VERSION}"; then
    skip "python${PYTHON_VERSION}"
  else
    info "Installing Python ${PYTHON_VERSION} via pyenv..."
    pyenv install "${PYTHON_VERSION}"
    ok "python${PYTHON_VERSION} installed"
  fi

  pyenv global "${PYTHON_VERSION}"
  ok "python global set to ${PYTHON_VERSION} ($(python --version))"
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
  _ensure_pyenv_in_path
  curl -sSL https://install.python-poetry.org | python -
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
  _ensure_pyenv_in_path
  poetry env use "$(pyenv which python)" 2>/dev/null || true
  # Allow the venv to see system-installed packages (e.g. mediapipe on ARM64)
  poetry config virtualenvs.options.system-site-packages true --local
  poetry install
  ok "Backend dependencies installed"

  # mediapipe has no official aarch64 wheel on PyPI but pip3 can resolve it
  # on some ARM boards (e.g. Radxa). Install it system-wide; the Poetry venv
  # will pick it up via system-site-packages (configured above).
  info "Installing mediapipe (system-wide via pip3)..."
  if pip3 install mediapipe --prefer-binary; then
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
  echo -e "  python:  $(python --version 2>&1)"
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
