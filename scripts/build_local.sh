#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/Producto/CodigoFuente/Front"
BACKEND_DIR="$ROOT_DIR/Producto/CodigoFuente/Deploy/backend_api"

echo "== Frontend install/build =="
cd "$FRONTEND_DIR"
npm install
npm run build

echo "== Backend dependency/test =="
cd "$BACKEND_DIR"
python --version
python -m pip install -r requirements.txt
python -m pytest -q

echo "CUMPLE: build local frontend/backend finalizado"
