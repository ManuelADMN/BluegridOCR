#!/usr/bin/env bash
# Genera un certificado TLS autofirmado para BluegridOCR (demo/entrega, sin dominio propio).
# Los navegadores mostrarán una advertencia de "no confiable" — es normal en autofirmados.
# Para producción real, usa un dominio propio + Let's Encrypt (ver SOLUCION_PUERTO_Y_HTTPS.md).
#
# Uso:   bash scripts/gen-selfsigned-cert.sh <host-o-ip>
# Ej.:   bash scripts/gen-selfsigned-cert.sh ec2-34-235-152-207.compute-1.amazonaws.com
set -euo pipefail

HOST="${1:-localhost}"
OUT_DIR="certs/prod"

mkdir -p "$OUT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$OUT_DIR/privkey.pem" \
  -out "$OUT_DIR/fullchain.pem" \
  -days 365 \
  -subj "/CN=$HOST" \
  -addext "subjectAltName=DNS:$HOST"

chmod 600 "$OUT_DIR/privkey.pem"
echo "Certificado autofirmado generado en $OUT_DIR/ para: $HOST"
echo "Ahora:  docker compose -f docker-compose.https.yml up -d --build"
