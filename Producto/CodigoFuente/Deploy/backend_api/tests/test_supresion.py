"""
Supresión real de datos personales (Loop 3 — Ley 21.719, arts. 4 y 7).

- Los tests de purga de archivos usan un STORAGE_ROOT temporal: filesystem puro, sin red ni BD.
- El test de autorización del endpoint es pre-BD (buzo → 403), no necesita Supabase.

Deliberadamente NO se incluye un test que ejecute la purga contra la BD viva: esa operación
anula recorte_base64 y borra archivos de forma irreversible, por lo que correrla contra
Supabase de producción destruiría datos reales. Un test de integración de la purga requiere
una BD desechable/staging con datos sintéticos.

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
    # Temp propio (no usamos tmp_path de pytest por restricciones de permisos en %TEMP%).
    d = Path(tempfile.mkdtemp(prefix="bluegrid_storage_test_"))
    monkeypatch.setattr(settings, "STORAGE_ROOT", str(d))
    try:
        yield d
    finally:
        shutil.rmtree(d, ignore_errors=True)


def _crear_archivos(root, rid, n=3):
    d = root / "registros" / str(rid)
    d.mkdir(parents=True)
    for i in range(n):
        (d / f"f{i}.png").write_bytes(b"x")
    return d


def test_eliminar_directorio_borra_todos_los_archivos(storage_root):
    d = _crear_archivos(storage_root, 7, n=3)
    assert storage.eliminar_directorio(7) == 3
    assert not d.exists()


def test_eliminar_directorio_es_idempotente(storage_root):
    # Carpeta inexistente → 0, sin error (permite reintentar la supresión).
    assert storage.eliminar_directorio(999) == 0


def test_eliminar_directorio_rechaza_id_invalido(storage_root):
    with pytest.raises(ValueError):
        storage.eliminar_directorio(0)
    with pytest.raises(ValueError):
        storage.eliminar_directorio(-5)


@pytest.fixture
def jwt_secret(monkeypatch):
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "test-secret-key")
    monkeypatch.setattr(settings, "JWT_ALGORITHM", "HS256")


def _token(role: str, uid: str = "1") -> str:
    return create_access_token({"sub": uid, "username": f"{role}@bluegrid.cl", "name": role, "role": role})


def test_purga_denegada_a_buzo(jwt_secret):
    """El buzo no puede purgar registros (solo admin/supervisor). 403 antes de tocar la BD."""
    client = TestClient(app)
    r = client.delete(
        "/api/v1/registros/1/purga",
        headers={"Authorization": f"Bearer {_token('buzo')}"},
    )
    assert r.status_code == 403
