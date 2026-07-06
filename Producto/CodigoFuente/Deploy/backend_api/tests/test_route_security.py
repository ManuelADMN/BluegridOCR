import pytest
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/analytics/buzos",
        "/api/v1/context/zonas",
        "/api/v1/context/embarcaciones",
        "/api/v1/context/tablillas",
        "/api/v1/dashboard/data",
        "/api/v1/reports/history",
        "/api/v1/reports/export",
        "/api/v1/users",
        "/api/v1/users/analytics",
        "/api/v1/registros/1",
        "/api/v1/registros/1/imagen",
        "/api/v1/training/excepciones/1",
    ],
)
def test_rutas_de_lectura_requieren_token(path: str):
    response = client.get(path)
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_health_permanece_publico():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
