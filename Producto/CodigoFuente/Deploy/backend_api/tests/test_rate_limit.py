"""
Tests del limitador de intentos de login (services/rate_limiter.py).

Los unitarios usan un reloj falso, así que son deterministas y no dependen de red ni de BD.
El de integración del endpoint sí necesita Supabase; se salta solo si la BD no responde.

Ejecutar (desde backend_api/):  python -m pytest tests/ -q
"""
import pytest
from fastapi.testclient import TestClient

from core.config import settings
from services.rate_limiter import LoginRateLimiter, login_rate_limiter
from main import app


class FakeClock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t

    def advance(self, seconds):
        self.t += seconds


def test_no_bloquea_bajo_el_umbral():
    clock = FakeClock()
    rl = LoginRateLimiter(max_attempts=5, time_fn=clock)
    for _ in range(4):
        assert rl.register_failure("ip|user") == 0
    assert rl.seconds_until_unlock("ip|user") == 0


def test_bloquea_al_alcanzar_el_umbral():
    clock = FakeClock()
    rl = LoginRateLimiter(max_attempts=5, base_lock_seconds=60, time_fn=clock)
    locked = 0
    for _ in range(5):
        locked = rl.register_failure("ip|user")
    assert locked == 60
    assert rl.seconds_until_unlock("ip|user") > 0


def test_desbloqueo_tras_expirar_el_tiempo():
    clock = FakeClock()
    rl = LoginRateLimiter(max_attempts=3, base_lock_seconds=60, time_fn=clock)
    for _ in range(3):
        rl.register_failure("ip|user")
    assert rl.seconds_until_unlock("ip|user") > 0
    clock.advance(61)
    assert rl.seconds_until_unlock("ip|user") == 0


def test_backoff_exponencial_en_reincidencia():
    clock = FakeClock()
    rl = LoginRateLimiter(max_attempts=2, base_lock_seconds=60, max_lock_seconds=900, time_fn=clock)
    # Primer bloqueo: 60s
    rl.register_failure("k"); first = rl.register_failure("k")
    assert first == 60
    clock.advance(61)
    # Segundo bloqueo: 120s (se duplica)
    rl.register_failure("k"); second = rl.register_failure("k")
    assert second == 120
    clock.advance(121)
    # Tercero: 240s
    rl.register_failure("k"); third = rl.register_failure("k")
    assert third == 240


def test_reset_limpia_el_estado():
    clock = FakeClock()
    rl = LoginRateLimiter(max_attempts=2, time_fn=clock)
    rl.register_failure("k"); rl.register_failure("k")
    assert rl.seconds_until_unlock("k") > 0
    rl.reset("k")
    assert rl.seconds_until_unlock("k") == 0


@pytest.fixture
def jwt_secret(monkeypatch):
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "test-secret-key")
    monkeypatch.setattr(settings, "JWT_ALGORITHM", "HS256")


def test_endpoint_bloqueado_responde_429_antes_de_la_bd(jwt_secret):
    """Si la clave (IP, usuario) ya está bloqueada, /auth/login responde 429 con Retry-After
    sin tocar la base de datos. Por eso este test no necesita Supabase."""
    key = "testclient|brute@bluegrid.cl"
    # Deja la clave bloqueada en el singleton que usa el endpoint.
    for _ in range(login_rate_limiter.max_attempts):
        login_rate_limiter.register_failure(key)
    try:
        client = TestClient(app)
        r = client.post("/api/v1/auth/login", json={"username": "brute@bluegrid.cl", "password": "whatever"})
        assert r.status_code == 429
        assert "Retry-After" in r.headers
    finally:
        login_rate_limiter.reset(key)


def test_endpoint_fuerza_bruta_termina_en_429(jwt_secret, db_up):
    """Integración (BD viva): credenciales inválidas repetidas acaban bloqueadas.

    Usa un usuario inexistente y único para no interferir con otros tests ni con datos reales.
    Los primeros intentos son 401; superado el umbral, el endpoint responde 429.
    """
    username = "no-existe-bruteforce-xyz@bluegrid.cl"
    key = f"testclient|{username}"
    login_rate_limiter.reset(key)
    client = TestClient(app)
    try:
        statuses = []
        for _ in range(login_rate_limiter.max_attempts + 1):
            r = client.post("/api/v1/auth/login", json={"username": username, "password": "malapass"})
            statuses.append(r.status_code)
        assert statuses[0] == 401           # primeros intentos: credenciales inválidas
        assert statuses[-1] == 429          # último: bloqueado por fuerza bruta
    finally:
        login_rate_limiter.reset(key)
