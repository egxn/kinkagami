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
    # Python build deps required by pyenv (missing any of these causes
    # missing extension modules such as _ctypes, _ssl, _sqlite3, etc.)
    libffi-dev
    libssl-dev
    zlib1g-dev
    libbz2-dev
    libreadline-dev
    libsqlite3-dev
    liblzma-dev
    tk-dev
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

  # Install mediapipe directly into the Poetry venv using its own pip.
  # --prefer-binary avoids source builds that require extra native toolchains.
  info "Installing mediapipe into Poetry venv..."
  VENV_PIP="$(poetry env info --path)/bin/pip"
  if "$VENV_PIP" install mediapipe --prefer-binary; then
    ok "mediapipe installed"
  else
    echo -e "  ${YELLOW}⏭${RESET} mediapipe not available for $(uname -m) — skipped"
  fi

  cd "$PROJECT_ROOT"
}

# ─── Autostart systemd service ───────────────────────────────────────────────

install_autostart() {
  echo ""
  echo -e "${BOLD}── Autostart (systemd) ──${RESET}"

  SCRIPT_DIR_ABS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT_ABS="$(cd "$SCRIPT_DIR_ABS/.." && pwd)"
  SERVICE_NAME="kinkagami"
  SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
  WRAPPER="$SCRIPT_DIR_ABS/autostart.sh"
  USER_NAME="$(whoami)"

  # Generate a wrapper script that sets up the environment at runtime
  # PROJECT_ROOT_ABS is embedded at generation time so the script knows
  # where to cd regardless of WorkingDirectory.
  cat > "$WRAPPER" <<WRAPPER_EOF
#!/usr/bin/env bash
set -e
cd "${PROJECT_ROOT_ABS}"
export HOME="${HOME}"
export PYENV_ROOT="${HOME}/.pyenv"
export PATH="\${PYENV_ROOT}/bin:\${PATH}"
eval "\$(pyenv init -)"
export NVM_DIR="${HOME}/.nvm"
[ -s "\${NVM_DIR}/nvm.sh" ] && . "\${NVM_DIR}/nvm.sh"

# Start the app in the background
pnpm dev:python &
APP_PID=\$!

# Wait for the Vite dev server to be ready, then open Chromium in kiosk mode
FRONTEND_PORT=5173
bash "${PROJECT_ROOT_ABS}/setup/wait-for-port.sh" 127.0.0.1 "\${FRONTEND_PORT}" 60

export DISPLAY="\${DISPLAY:-:0}"
chromium --kiosk \
  --use-fake-ui-for-media-stream \
  --autoplay-policy=no-user-gesture-required \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI \
  --start-fullscreen \
  "http://localhost:\${FRONTEND_PORT}" &

wait \$APP_PID
WRAPPER_EOF
  chmod +x "$WRAPPER"

  sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Kinkagami (pnpm dev:python)
After=network.target

[Service]
Type=simple
User=${USER_NAME}
WorkingDirectory=${PROJECT_ROOT_ABS}
Environment="HOME=${HOME}"
ExecStart=${WRAPPER}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable "$SERVICE_NAME"
  ok "Autostart enabled — run: sudo systemctl start ${SERVICE_NAME}"
}


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
  echo -e "    ${BOLD}pnpm dev:python${RESET}               # Run manually"
  echo -e "    ${BOLD}sudo systemctl start kinkagami${RESET} # Start now"
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
install_autostart
summary
