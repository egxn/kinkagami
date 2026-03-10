#!/usr/bin/env bash
set -euo pipefail

# Usage: ./pre.sh [KIOSK_URL]
KIOSK_URL="${1:-http://localhost:3000}"

echo "[pre] Installing runtime dependencies..."
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  chromium-browser \
  xserver-xorg \
  xinit \
  ffmpeg \
  v4l-utils

echo "[pre] Writing ~/.xinitrc (kiosk mode)..."
cat > "$HOME/.xinitrc" <<EOF
#!/usr/bin/env bash
set -euo pipefail

xset -dpms
xset s off
xset s noblank

exec chromium-browser \
  --kiosk \
  --no-first-run \
  --disable-default-apps \
  --disable-extensions \
  --disable-component-update \
  --disable-features=TranslateUI,MediaRouter,OptimizationHints,AutofillServerCommunication \
  --disable-background-networking \
  --disable-sync \
  --metrics-recording-only \
  --disable-breakpad \
  --password-store=basic \
  --use-mock-keychain \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --disable-infobars \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  --enable-gpu-rasterization \
  "$KIOSK_URL"
EOF
chmod +x "$HOME/.xinitrc"

echo "[pre] Ensuring auto-start X on tty1 in ~/.bash_profile..."
touch "$HOME/.bash_profile"
if ! grep -q "# KGM_AUTO_STARTX" "$HOME/.bash_profile"; then
  cat >> "$HOME/.bash_profile" <<'EOF'

# KGM_AUTO_STARTX
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx
fi
EOF
fi

echo "[pre] Done."
echo "[pre] Next: enable Console Autologin (raspi-config or board equivalent)."