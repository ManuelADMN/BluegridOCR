import os
import sys
import time
import subprocess
import threading
import requests
from pathlib import Path
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR  = Path(__file__).parent
API_DIR   = BASE_DIR / "Deploy" / "backend_api"
FRONT_DIR = BASE_DIR / "Front"
HOST      = "127.0.0.1"
PORT      = 8000

# ── Cargar .env ───────────────────────────────────────────────────────────────
load_dotenv(API_DIR / ".env")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
NGROK_TOKEN       = os.environ.get("NGROK_TOKEN", "")
HTTPS_ENABLED     = os.environ.get("HTTPS_ENABLED", "false").lower() in {"1", "true", "yes", "on"}
SSL_CERTFILE      = os.environ.get("SSL_CERTFILE", "")
SSL_KEYFILE       = os.environ.get("SSL_KEYFILE", "")

# ── Validar credenciales ──────────────────────────────────────────────────────
print("=" * 60)
print("  Bluegrid OCR — Iniciando sistema completo")
print("=" * 60)

if not ANTHROPIC_API_KEY or ANTHROPIC_API_KEY == "PEGAR_KEY_AQUI":
    print("❌ Falta ANTHROPIC_API_KEY en Deploy/backend_api/.env")
    sys.exit(1)
print("✅ ANTHROPIC_API_KEY detectada.")

use_ngrok = bool(NGROK_TOKEN)
if use_ngrok:
    print("✅ NGROK_TOKEN detectado.")
else:
    print("⚠️  Sin NGROK_TOKEN — backend solo en localhost.")

# ── Verificar node_modules ────────────────────────────────────────────────────
if not (FRONT_DIR / "node_modules").exists():
    print("\n📦 node_modules no encontrado, instalando dependencias npm...")
    result = subprocess.run(
        ["npm", "install"],
        cwd=str(FRONT_DIR),
        shell=True,
    )
    if result.returncode != 0:
        print("❌ Error al instalar dependencias npm.")
        sys.exit(1)
    print("✅ Dependencias npm instaladas.")

# ── Stream de logs con prefijo ────────────────────────────────────────────────
front_url = None

def stream(proc, prefix):
    global front_url
    try:
        for line in iter(proc.stdout.readline, ""):
            if line.strip():
                print(f"{prefix} {line.rstrip()}")
                if prefix == "[FRONT]" and "localhost:" in line and front_url is None:
                    import re
                    m = re.search(r"http://localhost:\d+", line)
                    if m:
                        front_url = m.group(0)
    except Exception:
        pass

# ── Arrancar Backend ──────────────────────────────────────────────────────────
print("\n⏳ Arrancando backend...")
env_back = {**os.environ, "ANTHROPIC_API_KEY": ANTHROPIC_API_KEY}
scheme = "https" if HTTPS_ENABLED else "http"
backend_cmd = [
    sys.executable, "-m", "uvicorn", "main:app",
    "--host", HOST, "--port", str(PORT), "--reload"
]
cert_path = None
key_path = None

if HTTPS_ENABLED:
    cert_path = (API_DIR / SSL_CERTFILE).resolve() if SSL_CERTFILE and not Path(SSL_CERTFILE).is_absolute() else Path(SSL_CERTFILE)
    key_path = (API_DIR / SSL_KEYFILE).resolve() if SSL_KEYFILE and not Path(SSL_KEYFILE).is_absolute() else Path(SSL_KEYFILE)
    if not cert_path.exists() or not key_path.exists():
        print("❌ HTTPS_ENABLED=true pero no existen SSL_CERTFILE/SSL_KEYFILE.")
        sys.exit(1)
    backend_cmd.extend(["--ssl-certfile", str(cert_path), "--ssl-keyfile", str(key_path)])

backend = subprocess.Popen(
    backend_cmd,
    cwd=str(API_DIR),
    env=env_back,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
)
threading.Thread(target=stream, args=(backend, "[BACK]"), daemon=True).start()

# Esperar que responda
ready = False
for _ in range(60):
    if backend.poll() is not None:
        print("❌ Backend cerró inesperadamente.")
        sys.exit(1)
    try:
        if requests.get(f"{scheme}://{HOST}:{PORT}/", timeout=2, verify=False).status_code < 500:
            ready = True
            break
    except Exception:
        pass
    time.sleep(1)

if not ready:
    print("❌ Timeout: el backend no respondió.")
    backend.terminate()
    sys.exit(1)
print(f"✅ Backend listo en {scheme}://{HOST}:{PORT}")

# ── Ngrok (opcional) ──────────────────────────────────────────────────────────
public_url = None
if use_ngrok:
    try:
        from pyngrok import ngrok, conf
        try:
            ngrok.set_auth_token(NGROK_TOKEN)
        except Exception:
            conf.get_default().auth_token = NGROK_TOKEN
        tunnel = ngrok.connect(addr=str(PORT), proto="http")
        public_url = tunnel.public_url
        print(f"✅ Ngrok activo: {public_url}")
    except ImportError:
        print("⚠️  pyngrok no instalado: pip install pyngrok")
    except Exception as e:
        msg = str(e).splitlines()[0]  # solo la primera línea del error
        print(f"⚠️  Ngrok no disponible: {msg}")

# ── Arrancar Frontend ─────────────────────────────────────────────────────────
print("\n⏳ Arrancando frontend...")
frontend = subprocess.Popen(
    ["npm", "run", "dev"],
    cwd=str(FRONT_DIR),
    env={
        **os.environ,
        "VITE_API_BASE_URL": public_url or f"{scheme}://localhost:{PORT}",
        "VITE_HTTPS": "true" if HTTPS_ENABLED else "false",
        "VITE_SSL_CERTFILE": str(cert_path) if HTTPS_ENABLED and cert_path else "",
        "VITE_SSL_KEYFILE": str(key_path) if HTTPS_ENABLED and key_path else "",
    },
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
    shell=True,
)
threading.Thread(target=stream, args=(frontend, "[FRONT]"), daemon=True).start()

# Esperar que Vite esté listo
time.sleep(3)

# ── Resumen ───────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  Sistema listo")
print("=" * 60)
print(f"  Frontend  → {front_url or 'http://localhost:5173'}")
print(f"  Backend   → {scheme}://{HOST}:{PORT}")
if public_url:
    print(f"  Ngrok     → {public_url}")
print(f"  API docs  → {scheme}://{HOST}:{PORT}/docs")
print("=" * 60)
print("  Ctrl+C para detener todo\n")

# ── Mantener vivo + Ctrl+C ────────────────────────────────────────────────────
try:
    while True:
        if backend.poll() is not None:
            print("\n⚠️  Backend detenido inesperadamente.")
            break
        if frontend.poll() is not None:
            print("\n⚠️  Frontend detenido inesperadamente.")
            break
        time.sleep(1)
except KeyboardInterrupt:
    print("\n🛑 Deteniendo todo...")
finally:
    backend.terminate()
    frontend.terminate()
    if public_url:
        try:
            from pyngrok import ngrok
            ngrok.disconnect(public_url)
        except Exception:
            pass
    print("✅ Sistema detenido.")
