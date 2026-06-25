#!/usr/bin/env sh
set -eu

BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000/api/v1/health}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:3000/healthz}"

check_url() {
  name="$1"
  url="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "$url" >/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$url" >/dev/null
  else
    echo "NO CUMPLE: curl/wget no disponible para validar $name"
    return 2
  fi
  echo "CUMPLE: $name responde en $url"
}

check_url "backend" "$BACKEND_URL"
check_url "frontend" "$FRONTEND_URL"
