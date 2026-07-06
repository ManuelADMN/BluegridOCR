"""
Autorización por rol (admin / supervisor / buzo) en los endpoints protegidos.

Estos tests NO necesitan base de datos: `require_roles` resuelve el 403 durante la fase
de dependencias, ANTES de validar el cuerpo o de abrir conexión a la BD. Por eso un buzo
recibe 403 de forma determinista aunque construya la petición a mano, y los roles permitidos
nunca son bloqueados por rol (aunque luego el body/BD devuelva 422/500).

Regla del proyecto: ocultar botones NO es seguridad; la autoridad final es el backend.

Ejecutar (desde backend_api/):  python -m pytest tests/test_role_permissions.py -q
"""
import pytest
from fastapi.testclient import TestClient

from core.config import settings
from services.jwt_service import create_access_token
from main import app

# raise_server_exceptions=False: sin BD algunos endpoints permitidos devuelven 500 en vez de
# propagar la excepción. Para estos tests solo nos importa el control de rol (403), así que
# preferimos recibir el 500 como respuesta y afirmar "!= 403".
client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "test-secret-key")
    monkeypatch.setattr(settings, "JWT_ALGORITHM", "HS256")


def _token(role: str, user_id: str = "1") -> str:
    return create_access_token(
        {"sub": user_id, "username": f"{role}@bluegrid.cl", "name": role, "role": role}
    )


def _call(method: str, path: str, role: str):
    headers = {"Authorization": f"Bearer {_token(role)}"}
    return client.request(method, path, headers=headers)


# (método, ruta): endpoints donde el buzo debe ser rechazado (admin y supervisor permitidos).
ADMIN_OR_SUPERVISOR = [
    ("GET", "/api/v1/dashboard/data"),
    ("GET", "/api/v1/analytics/buzos"),
    ("GET", "/api/v1/reports/history"),
    ("GET", "/api/v1/reports/export"),
    ("GET", "/api/v1/registros/1"),
    ("GET", "/api/v1/registros/1/imagen"),
    ("GET", "/api/v1/context/embarcaciones"),
    ("GET", "/api/v1/context/tablillas"),
    ("PUT", "/api/v1/registros/1/validacion"),
    ("PATCH", "/api/v1/registros/1/rechazo"),
    ("PATCH", "/api/v1/registros/1/estado"),
    ("DELETE", "/api/v1/registros/1"),
]

# Endpoints exclusivos de admin (buzo y supervisor rechazados).
ADMIN_ONLY = [
    ("GET", "/api/v1/users"),
    ("GET", "/api/v1/users/analytics"),
    ("POST", "/api/v1/users"),
    ("PATCH", "/api/v1/users/1"),
    ("DELETE", "/api/v1/users/1"),
]

# Endpoints que el buzo SÍ puede usar (indispensables para digitalizar).
BUZO_ALLOWED = [
    ("GET", "/api/v1/context/zonas"),
    ("POST", "/api/v1/registros"),
]


@pytest.mark.parametrize("method,path", ADMIN_OR_SUPERVISOR)
def test_buzo_recibe_403_en_endpoints_de_gestion(method, path):
    assert _call(method, path, "buzo").status_code == 403


@pytest.mark.parametrize("method,path", ADMIN_OR_SUPERVISOR + ADMIN_ONLY)
def test_admin_no_es_bloqueado_por_rol(method, path):
    # El admin nunca es rechazado por rol (luego podrá fallar por body/BD, pero jamás 403).
    assert _call(method, path, "admin").status_code != 403


@pytest.mark.parametrize("method,path", ADMIN_OR_SUPERVISOR)
def test_supervisor_no_es_bloqueado_por_rol(method, path):
    assert _call(method, path, "supervisor").status_code != 403


@pytest.mark.parametrize("method,path", ADMIN_ONLY)
def test_supervisor_recibe_403_en_endpoints_solo_admin(method, path):
    assert _call(method, path, "supervisor").status_code == 403


@pytest.mark.parametrize("method,path", ADMIN_ONLY)
def test_buzo_recibe_403_en_endpoints_solo_admin(method, path):
    assert _call(method, path, "buzo").status_code == 403


@pytest.mark.parametrize("method,path", BUZO_ALLOWED)
def test_buzo_no_es_bloqueado_en_endpoints_de_digitalizacion(method, path):
    # Rol permitido: nunca 403 (puede devolver 422/500 por body/BD, lo cual es aceptable aquí).
    assert _call(method, path, "buzo").status_code != 403


def test_sin_token_responde_401():
    # Sin credenciales, la seguridad HTTPBearer responde 401 antes que cualquier lógica.
    assert client.get("/api/v1/dashboard/data").status_code == 401
