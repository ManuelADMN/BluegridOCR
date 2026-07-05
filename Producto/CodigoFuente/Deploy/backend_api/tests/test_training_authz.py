"""
Autorización horizontal en /training/excepciones/{usuario_id} (sin red ni BD).

La comprobación de propiedad ocurre ANTES de abrir conexión a la base de datos,
igual que la comprobación de rol, así que estos tests no necesitan una BD real.

Contexto legal: evita que un buzo lea los recortes de escritura (recorte_base64) de
otro titular. Ver Ley 21.719, arts. 14 bis (confidencialidad) y 14 quinquies (seguridad).

Ejecutar (desde backend_api/):  python -m pytest tests/ -q
"""
import pytest
from fastapi.testclient import TestClient

from core.config import settings
from services.jwt_service import create_access_token
from main import app


@pytest.fixture
def jwt_secret(monkeypatch):
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "test-secret-key")
    monkeypatch.setattr(settings, "JWT_ALGORITHM", "HS256")


def _token(role: str, user_id: str) -> str:
    return create_access_token(
        {"sub": user_id, "username": f"{role}@bluegrid.cl", "name": role, "role": role}
    )


def test_buzo_no_accede_excepciones_de_otro_usuario(jwt_secret):
    """Un buzo (id=1) pidiendo las excepciones del usuario 2 debe recibir 403."""
    client = TestClient(app)
    r = client.get(
        "/api/v1/training/excepciones/2",
        headers={"Authorization": f"Bearer {_token('buzo', '1')}"},
    )
    assert r.status_code == 403  # denegado antes de tocar la BD


def test_buzo_accede_a_sus_propias_excepciones(jwt_secret, db_up):
    """Integración (BD viva): el buzo (id=1) sí puede consultar sus propias correcciones.

    El endpoint devuelve 200 con la lista (posiblemente vacía), nunca 403 para el dueño.
    """
    client = TestClient(app)
    r = client.get(
        "/api/v1/training/excepciones/1",
        headers={"Authorization": f"Bearer {_token('buzo', '1')}"},
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_accede_a_excepciones_de_cualquiera(jwt_secret, db_up):
    """Integración (BD viva): admin no está sujeto al control de propiedad."""
    client = TestClient(app)
    r = client.get(
        "/api/v1/training/excepciones/999",
        headers={"Authorization": f"Bearer {_token('admin', '1')}"},
    )
    assert r.status_code == 200
