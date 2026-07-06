#!/usr/bin/env python3
"""
Depuración puntual: rechaza y PURGA (irreversible) todos los registros en
estado PENDIENTE_VALIDACION, operando vía la API (respeta triggers, auditoría y permisos).

Por defecto es DRY-RUN: solo lista y cuenta, no toca nada. Con --apply ejecuta.

Uso (desde backend_api/):
    # Dry-run contra un backend local que apunta a la BD real:
    BLUEGRID_ADMIN_PASSWORD=... python scripts/depurar_pendientes.py
    # Ejecutar de verdad:
    BLUEGRID_ADMIN_PASSWORD=... python scripts/depurar_pendientes.py --apply

Opciones:
    --base-url URL   Base del API           (default http://localhost:8000 / env BLUEGRID_BASE_URL)
    --username U     Correo admin           (default admin@bluegrid.cl / env BLUEGRID_ADMIN_USER)
    --password P     Clave admin            (o env BLUEGRID_ADMIN_PASSWORD)
    --motivo M       Motivo de rechazo
    --apply          Ejecuta rechazo + purga (sin el flag = dry-run)

NOTA: la purga es IRREVERSIBLE (borra imágenes en disco y recortes biométricos).
Rota la contraseña admin tras usar este script.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

API_PREFIX = "/api/v1"
MAX_HISTORY = 500  # tope del endpoint /reports/history


def _req(method, url, token=None, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode(errors="replace")
            ctype = resp.headers.get_content_type()
            return resp.status, (json.loads(raw) if raw and ctype == "application/json" else raw)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="replace")
        try:
            return exc.code, json.loads(raw)
        except Exception:
            return exc.code, raw
    except urllib.error.URLError as exc:
        sys.exit(f"[ERROR] No se pudo conectar a {url}: {exc}")


def login(base, user, password):
    status, body = _req("POST", f"{base}{API_PREFIX}/auth/login",
                        body={"username": user, "password": password})
    if status != 200 or not isinstance(body, dict) or "access_token" not in body:
        sys.exit(f"[ERROR] Login falló ({status}): {body}")
    print(f"[INFO] Autenticado como {body.get('username')} (rol={body.get('role')})")
    return body["access_token"]


def list_pending(base, token):
    status, body = _req(
        "GET",
        f"{base}{API_PREFIX}/reports/history?estado=PENDIENTE_VALIDACION&limit={MAX_HISTORY}",
        token=token,
    )
    if status != 200 or not isinstance(body, dict):
        sys.exit(f"[ERROR] Listado de pendientes falló ({status}): {body}")
    ids = [int(item["id_registro"]) for item in body.get("items", [])]
    if len(ids) >= MAX_HISTORY:
        print(f"[WARN] Se alcanzó el tope de {MAX_HISTORY}; puede haber más. Re-ejecuta tras esta pasada.")
    return ids


def main():
    parser = argparse.ArgumentParser(description="Rechaza y purga los registros pendientes.")
    parser.add_argument("--base-url", default=os.environ.get("BLUEGRID_BASE_URL", "http://localhost:8000"))
    parser.add_argument("--username", default=os.environ.get("BLUEGRID_ADMIN_USER", "admin@bluegrid.cl"))
    parser.add_argument("--password", default=os.environ.get("BLUEGRID_ADMIN_PASSWORD"))
    parser.add_argument("--motivo", default="Depuración masiva de pendientes — administración")
    parser.add_argument("--ids", default=None,
                        help="Lista explícita de id_registro separada por comas (en vez de listar pendientes)")
    parser.add_argument("--apply", action="store_true", help="Ejecuta (sin el flag es dry-run)")
    args = parser.parse_args()

    if not args.password:
        sys.exit("[ERROR] Falta la contraseña (--password o env BLUEGRID_ADMIN_PASSWORD).")

    base = args.base_url.rstrip("/")
    token = login(base, args.username, args.password)

    if args.ids:
        ids = [int(x) for x in args.ids.replace(" ", "").split(",") if x]
        print(f"[INFO] IDs explícitos: {len(ids)}")
    else:
        ids = list_pending(base, token)
        print(f"[INFO] Pendientes encontrados: {len(ids)}")
    if ids:
        print("[INFO] IDs:", ", ".join(map(str, ids)))

    if not args.apply:
        print("[DRY-RUN] No se modificó nada. Re-ejecuta con --apply para rechazar y purgar.")
        return

    if not ids:
        print("[INFO] Nada que hacer.")
        return

    rechazados, purgados, errores = 0, 0, 0
    for rid in ids:
        s1, b1 = _req("PATCH", f"{base}{API_PREFIX}/registros/{rid}/rechazo",
                     token=token, body={"motivo": args.motivo})
        if s1 == 200:
            rechazados += 1
        elif s1 != 404:  # 404 = ya no existe; continuamos a intentar purgar igualmente
            print(f"[ERROR] rechazo {rid}: {s1} {b1}")
            errores += 1
            continue

        s2, b2 = _req("DELETE", f"{base}{API_PREFIX}/registros/{rid}/purga", token=token)
        if s2 in (200, 404):
            purgados += 1
            print(f"[OK] {rid}: rechazado + purgado")
        else:
            print(f"[ERROR] purga {rid}: {s2} {b2}")
            errores += 1

    restantes = list_pending(base, token)
    print(f"[RESUMEN] rechazados={rechazados} purgados={purgados} errores={errores} "
          f"pendientes_restantes={len(restantes)}")


if __name__ == "__main__":
    main()
