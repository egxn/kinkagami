#!/usr/bin/env bash
# Generates a locally trusted HTTPS certificate for development.
#
#   bash setup/dev-cert.sh [--force] [--ip 192.168.1.20] [--host my.name]
#
# Uses `mkcert` when installed (recommended). Otherwise builds a private local
# CA with `openssl` and signs the certificate with it; import that CA once into
# your OS/browser trust store (instructions are printed).
#
# Output (git-ignored): .certs/kinkagami.pem, .certs/kinkagami-key.pem
# Names covered: localhost, 127.0.0.1, ::1, embedded.kinkagami.test, web.kinkagami.test
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${KGM_CERT_DIR:-$ROOT_DIR/.certs}"
CERT="$OUT_DIR/kinkagami.pem"
KEY="$OUT_DIR/kinkagami-key.pem"
CA_KEY="$OUT_DIR/kinkagami-dev-ca-key.pem"
CA_CERT="$OUT_DIR/kinkagami-dev-ca.pem"
DAYS=825

DNS_NAMES=(localhost embedded.kinkagami.test web.kinkagami.test)
IP_ADDRS=(127.0.0.1 ::1)
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --) ;;  # pnpm run certs:dev -- --force passes a literal "--"
    --force) FORCE=1 ;;
    --ip) shift; IP_ADDRS+=("${1:?--ip needs a value}") ;;
    --host) shift; DNS_NAMES+=("${1:?--host needs a value}") ;;
    -h|--help) sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

if [[ -f "$CERT" && -f "$KEY" && "$FORCE" -eq 0 ]]; then
  echo "Certificate already exists: $CERT"
  echo "Use --force to regenerate (e.g. after adding --ip/--host)."
  exit 0
fi

mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

ALL_NAMES=("${DNS_NAMES[@]}" "${IP_ADDRS[@]}")

if command -v mkcert >/dev/null 2>&1; then
  echo "Using mkcert for: ${ALL_NAMES[*]}"
  mkcert -cert-file "$CERT" -key-file "$KEY" "${ALL_NAMES[@]}"
  chmod 600 "$KEY"
  echo
  echo "If you haven't yet, trust mkcert's CA once:  mkcert -install"
else
  command -v openssl >/dev/null 2>&1 || { echo "Need mkcert or openssl installed." >&2; exit 1; }
  echo "mkcert not found; using openssl with a private local CA."

  if [[ ! -f "$CA_CERT" || ! -f "$CA_KEY" || "$FORCE" -eq 1 ]]; then
    openssl ecparam -name prime256v1 -genkey -noout -out "$CA_KEY" 2>/dev/null
    openssl req -x509 -new -key "$CA_KEY" -sha256 -days 3650 \
      -subj "/CN=Kinkagami Dev CA" \
      -addext "basicConstraints=critical,CA:TRUE" \
      -addext "keyUsage=critical,keyCertSign,cRLSign" \
      -out "$CA_CERT"
    chmod 600 "$CA_KEY"
    NEW_CA=1
  else
    NEW_CA=0
  fi

  SAN=""
  for name in "${DNS_NAMES[@]}"; do SAN+="DNS:${name},"; done
  for ip in "${IP_ADDRS[@]}"; do SAN+="IP:${ip},"; done
  SAN="${SAN%,}"

  EXT_FILE="$(mktemp)"
  CSR_FILE="$(mktemp)"
  trap 'rm -f "$EXT_FILE" "$CSR_FILE"' EXIT
  cat > "$EXT_FILE" <<EXT
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=${SAN}
EXT

  openssl ecparam -name prime256v1 -genkey -noout -out "$KEY" 2>/dev/null
  openssl req -new -key "$KEY" -subj "/CN=localhost" -out "$CSR_FILE"
  openssl x509 -req -in "$CSR_FILE" -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial \
    -out "$CERT" -days "$DAYS" -sha256 -extfile "$EXT_FILE" 2>/dev/null
  chmod 600 "$KEY"

  echo
  echo "Trust the local CA once so browsers accept the certificate:"
  echo "  CA file: $CA_CERT"
  echo "  Debian/Ubuntu: sudo cp \"$CA_CERT\" /usr/local/share/ca-certificates/kinkagami-dev-ca.crt && sudo update-ca-certificates"
  echo "  macOS:         sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain \"$CA_CERT\""
  echo "  Chrome/Edge/Firefox on Linux use their own store: import the file under Settings > Certificates > Authorities"
  [[ "${NEW_CA:-0}" -eq 1 ]] || echo "  (Reused existing CA: already-trusted setups need no changes.)"
fi

echo
echo "Created:"
echo "  $CERT"
echo "  $KEY"
echo
echo "Next:"
echo "  pnpm hosts:add            # map the *.kinkagami.test names to 127.0.0.1"
echo "  pnpm dev:web:https        # https://web.kinkagami.test:5174"
echo "  pnpm dev:embedded:https   # https://embedded.kinkagami.test:5173"
