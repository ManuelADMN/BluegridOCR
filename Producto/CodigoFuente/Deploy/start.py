import os
import sys
import time
import subprocess
import requests
from pathlib import Path
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).parent
API_DIR  = BASE_DIR / "backend_api"
HOST     = "127.0.0.1"
PORT     = 8000

# ── Cargar .env ───────────────────────────────────────────────────────────────
load_dotenv(API_DIR / ".env")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
NGROK_TOKEN       = os.environ.get("NGROK_TOKEN", "")
HTTPS_ENABLED     = os.environ.get("HTTPS_ENABLED", "false").lower() in {"1", "true", "yes", "on"}
SSL_CERTFILE      = os.environ.get("SSL_CERTFILE", "")
SSL_KEYFILE       = os.environ.get("SSL_KEYFILE", "")

# ── Validar credenciales ──────────────────────────────────────────────────────
print("\n🔍 Verificando credenciales...")
if not ANTHROPIC_API_KEY or ANTHROPIC_API_KEY == "PEGAR_KEY_AQUI":
    print("❌ Falta ANTHROPIC_API_KEY en backend_api/.env")
    sys.exit(1)
print("✅ ANTHROPIC_API_KEY detectada.")

use_ngrok = bool(NGROK_TOKEN)
if use_ngrok:
    print("✅ NGROK_TOKEN detectado — se abrirá túnel público.")
else:
    print("⚠️  Sin NGROK_TOKEN — el backend solo estará en localhost.")

# ── Verificar archivos críticos ───────────────────────────────────────────────
print("\n🔍 Verificando archivos del backend...")
criticos = [
    API_DIR / "main.py",
    API_DIR / "services" / "db.py",
    API_DIR / "services" / "motor_ia.py",
    API_DIR / "routers" / "operations.py",
    API_DIR / "routers" / "auth.py",
    API_DIR / "routers" / "dashboard.py",
]
for f in criticos:
    estado = "✅" if f.exists() else "❌ FALTA"
    print(f"  {estado}  {f.relative_to(BASE_DIR)}")
    if not f.exists():
        sys.exit(1)

# ── Arrancar Uvicorn ──────────────────────────────────────────────────────────
scheme = "https" if HTTPS_ENABLED else "http"
server_cmd = [
    sys.executable, "-m", "uvicorn", "main:app",
    "--host", HOST, "--port", str(PORT), "--reload"
]
if HTTPS_ENABLED:
    cert_path = (API_DIR / SSL_CERTFILE).resolve() if SSL_CERTFILE and not Path(SSL_CERTFILE).is_absolute() else Path(SSL_CERTFILE)
    key_path = (API_DIR / SSL_KEYFILE).resolve() if SSL_KEYFILE and not Path(SSL_KEYFILE).is_absolute() else Path(SSL_KEYFILE)
    if not cert_path.exists() or not key_path.exists():
        print("❌ HTTPS_ENABLED=true pero no existen SSL_CERTFILE/SSL_KEYFILE.")
        sys.exit(1)
    server_cmd.extend(["--ssl-certfile", str(cert_path), "--ssl-keyfile", str(key_path)])

print(f"\n⏳ Arrancando backend en {scheme}://{HOST}:{PORT} ...")
env = {**os.environ, "ANTHROPIC_API_KEY": ANTHROPIC_API_KEY}

server = subprocess.Popen(
    server_cmd,
    cwd=str(API_DIR),
    env=env,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
)

# Esperar hasta que responda (máx 60s)
ready = False
start_t = time.time()
while time.time() - start_t < 60:
    if server.poll() is not None:
        print("❌ Uvicorn cerró inesperadamente:")
        print(server.stdout.read())
        sys.exit(1)
    try:
        if requests.get(f"{scheme}://{HOST}:{PORT}/", timeout=2, verify=False).status_code < 500:
            ready = True
            break
    except Exception:
        pass
    time.sleep(1)

if not ready:
    print("❌ Timeout: el servidor no respondió en 60s.")
    sys.exit(1)

print(f"✅ Backend listo en {round(time.time() - start_t, 1)}s")

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
        print("=" * 60)
        print(f"🌍 URL pública : {public_url}")
        print(f"📘 Swagger     : {public_url}/docs")
        print("=" * 60)
    except ImportError:
        print("⚠️  pyngrok no instalado. Corre: pip install pyngrok")
    except Exception as e:
        print(f"⚠️  Error ngrok: {e}")

if not public_url:
    print("=" * 60)
    print(f"🏠 Backend local : {scheme}://{HOST}:{PORT}")
    print(f"📘 Swagger       : {scheme}://{HOST}:{PORT}/docs")
    print("=" * 60)

# ── Streaming de logs ─────────────────────────────────────────────────────────
print("\n📜 Logs en vivo (Ctrl+C para detener):\n")
try:
    while True:
        if server.poll() is not None:
            print("⚠️  Servidor detenido.")
            break
        line = server.stdout.readline()
        if line:
            print(line.rstrip())
        time.sleep(0.05)
except KeyboardInterrupt:
    print("\n🛑 Detenido por el usuario.")
    server.terminate()
    if public_url:
        try:
            from pyngrok import ngrok
            ngrok.disconnect(public_url)
        except Exception:
            pass
