"""
Tests del almacenamiento de imágenes en disco y del control de acceso del endpoint
GET /api/v1/registros/{id}/imagen (solo admin/supervisor).

Sin red, sin base de datos, sin Claude:
- storage.py opera sobre un directorio temporal (tmp_path).
- El endpoint se prueba con TestClient + tokens JWT fabricados (get_current_user solo
  decodifica el token, no consulta la BD).

Ejecutar (desde backend_api/):  python -m pytest tests/ -q
"""
import shutil
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from core.config import settings
from services import storage
from services.jwt_service import create_access_token
from main import app


@pytest.fixture
def storage_root(monkeypatch):
    # tempfile.mkdtemp evita el fixture tmp_path de pytest (que en este entorno falla por
    # ACL al escanear ...\Temp\pytest-of-madzm).
    d = tempfile.mkdtemp(prefix="bluegrid_imgtest_")
    monkeypatch.setattr(settings, "STORAGE_ROOT", d)
    yield Path(d)
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture
def jwt_secret(monkeypatch):
    # Determinista, independiente del .env del entorno.
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "test-secret-key")
    monkeypatch.setattr(settings, "JWT_ALGORITHM", "HS256")


def _token(role: str) -> str:
    return create_access_token({"sub": "1", "username": f"{role}@bluegrid.cl", "name": role, "role": role})


# ── storage.py (LE-03) ────────────────────────────────────────────────────────
def test_guardar_y_ruta_relativa(storage_root):
    rel = storage.guardar_bytes(12, "original", b"hola-bytes")
    assert rel == "registros/12/original.jpg"
    assert storage.ruta_imagen(12, "original").read_bytes() == b"hola-bytes"
    assert storage.existe(12, "original") is True
    assert storage.existe(99, "original") is False


def test_guardar_b64_y_none(storage_root):
    import base64
    rel = storage.guardar_b64(7, "warped", base64.b64encode(b"png-data").decode())
    assert rel == "registros/7/warped.png"
    assert storage.guardar_b64(7, "warped", None) is None  # sin datos no falla


def test_tipo_invalido_rechazado(storage_root):
    with pytest.raises(ValueError):
        storage.ruta_imagen(1, "../../etc/passwd")
    with pytest.raises(ValueError):
        storage.ruta_imagen(1, "secreto")


def test_id_invalido_rechazado(storage_root):
    with pytest.raises(ValueError):
        storage.registro_dir(0)
    with pytest.raises((ValueError, TypeError)):
        storage.registro_dir("12/../../x")  # no es entero -> rechazado


# ── endpoint RBAC (LE-05): solo admin/supervisor ─────────────────────────────
def test_imagen_admin_y_supervisor_200(storage_root, jwt_secret):
    storage.guardar_bytes(5, "original", b"jpegdata")
    client = TestClient(app)
    for role in ("admin", "supervisor"):
        r = client.get("/api/v1/registros/5/imagen?tipo=original",
                       headers={"Authorization": f"Bearer {_token(role)}"})
        assert r.status_code == 200, role
        assert r.content == b"jpegdata"
        assert r.headers["content-type"].startswith("image/")


def test_imagen_buzo_403(storage_root, jwt_secret):
    storage.guardar_bytes(5, "original", b"jpegdata")
    client = TestClient(app)
    r = client.get("/api/v1/registros/5/imagen?tipo=original",
                   headers={"Authorization": f"Bearer {_token('buzo')}"})
    assert r.status_code == 403  # <-- requisito central: el buzo NO ve imágenes


def test_imagen_sin_token_403(storage_root, jwt_secret):
    client = TestClient(app)
    r = client.get("/api/v1/registros/5/imagen?tipo=original")
    assert r.status_code == 403  # HTTPBearer sin credenciales


def test_imagen_inexistente_404(storage_root, jwt_secret):
    client = TestClient(app)
    r = client.get("/api/v1/registros/123/imagen?tipo=original",
                   headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r.status_code == 404


def test_imagen_tipo_invalido_400(storage_root, jwt_secret):
    client = TestClient(app)
    r = client.get("/api/v1/registros/5/imagen?tipo=zzz",
                   headers={"Authorization": f"Bearer {_token('admin')}"})
    assert r.status_code == 400
