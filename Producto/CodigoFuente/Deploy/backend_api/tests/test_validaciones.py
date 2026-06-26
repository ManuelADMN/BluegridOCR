"""
Validaciones de payload sin red ni BD:
- El motivo de rechazo está limitado a 200 caracteres (la validación pydantic ocurre ANTES
  de ejecutar el endpoint, así que no toca la base de datos).

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


def _token(role: str) -> str:
    return create_access_token({"sub": "1", "username": f"{role}@bluegrid.cl", "name": role, "role": role})


def test_rechazo_motivo_mayor_200_da_422(jwt_secret):
    client = TestClient(app)
    r = client.patch(
        "/api/v1/registros/1/rechazo",
        headers={"Authorization": f"Bearer {_token('supervisor')}"},
        json={"motivo": "x" * 201},
    )
    assert r.status_code == 422  # rechazado por validación antes de tocar la BD


def test_rechazo_motivo_vacio_da_422(jwt_secret):
    client = TestClient(app)
    r = client.patch(
        "/api/v1/registros/1/rechazo",
        headers={"Authorization": f"Bearer {_token('supervisor')}"},
        json={"motivo": ""},
    )
    assert r.status_code == 422  # min_length=1


def test_rechazo_buzo_403(jwt_secret):
    client = TestClient(app)
    r = client.patch(
        "/api/v1/registros/1/rechazo",
        headers={"Authorization": f"Bearer {_token('buzo')}"},
        json={"motivo": "motivo válido"},
    )
    assert r.status_code == 403  # el buzo no modera
