#!/usr/bin/env bash
# Manages the /etc/hosts entries used for HTTPS development.
#
#   bash setup/dev-hosts.sh add|remove|status [--dry-run]
#
# Adds a clearly marked block mapping embedded.kinkagami.test and
# web.kinkagami.test to 127.0.0.1 / ::1, and removes it again. Idempotent.
# Writing the real hosts file needs sudo (you'll be prompted); --dry-run only
# shows the diff. Override the file with HOSTS_FILE=... (e.g. to test, or
# /mnt/c/Windows/System32/drivers/etc/hosts from WSL in an elevated shell).
set -euo pipefail

HOSTS_FILE="${HOSTS_FILE:-/etc/hosts}"
NAMES=(embedded.kinkagami.test web.kinkagami.test)
BEGIN="# >>> kinkagami dev hosts >>>"
END="# <<< kinkagami dev hosts <<<"

ACTION="${1:-status}"
DRY_RUN=0
[[ "${2:-}" == "--dry-run" ]] && DRY_RUN=1

case "$ACTION" in
  add|remove|status) ;;
  -h|--help) sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "Usage: $0 add|remove|status [--dry-run]" >&2; exit 2 ;;
esac

has_block() { grep -qF "$BEGIN" "$HOSTS_FILE" 2>/dev/null; }

strip_block() {
  awk -v b="$BEGIN" -v e="$END" '
    $0 == b { skip = 1; next }
    $0 == e { skip = 0; next }
    !skip { print }
  ' "$HOSTS_FILE"
}

if [[ "$ACTION" == "status" ]]; then
  if has_block; then
    echo "Kinkagami dev hosts: PRESENT in $HOSTS_FILE"
    awk -v b="$BEGIN" -v e="$END" '$0==b{p=1} p{print "  " $0} $0==e{p=0}' "$HOSTS_FILE"
  else
    echo "Kinkagami dev hosts: not present in $HOSTS_FILE (run: pnpm hosts:add)"
  fi
  exit 0
fi

NEW_FILE="$(mktemp)"
trap 'rm -f "$NEW_FILE"' EXIT

# Drop any previous block (keeps `add` idempotent and lets `remove` reuse this).
strip_block > "$NEW_FILE"

# Portable (GNU/BSD) removal of trailing blank lines, so repeated add/remove
# cycles never pile up or leave stray blank lines. Only when we touch the file.
trim_trailing_blanks() {
  awk '{ l[NR] = $0 } END { n = NR; while (n > 0 && l[n] == "") n--; for (i = 1; i <= n; i++) print l[i] }'
}

if [[ "$ACTION" == "add" ]] || has_block; then
  trim_trailing_blanks < "$NEW_FILE" > "$NEW_FILE.trim" && mv "$NEW_FILE.trim" "$NEW_FILE"
fi

if [[ "$ACTION" == "add" ]]; then
  {
    echo
    echo "$BEGIN"
    echo "127.0.0.1 ${NAMES[*]}"
    echo "::1       ${NAMES[*]}"
    echo "$END"
  } >> "$NEW_FILE"
fi

if cmp -s "$NEW_FILE" "$HOSTS_FILE"; then
  echo "No changes needed in $HOSTS_FILE."
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] changes that would be made to $HOSTS_FILE:"
  diff -u "$HOSTS_FILE" "$NEW_FILE" || true
  exit 0
fi

if [[ -w "$HOSTS_FILE" ]]; then
  cat "$NEW_FILE" > "$HOSTS_FILE"
else
  echo "Writing $HOSTS_FILE requires elevated permissions (sudo)."
  sudo tee "$HOSTS_FILE" < "$NEW_FILE" > /dev/null
fi

if [[ "$ACTION" == "add" ]]; then
  echo "Added: ${NAMES[*]} -> 127.0.0.1"
else
  echo "Removed the Kinkagami dev hosts block."
fi
