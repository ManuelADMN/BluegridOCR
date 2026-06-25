"""
Tests unitarios del modo OCR `full_rectangle` y de la robustez del motor en
services/motor_ia.py.

Reglas de estos tests:
- NO realizan llamadas reales a Claude: el cliente Anthropic se mockea a nivel de los
  métodos `_call_claude_*` de la instancia del servicio.
- NO tocan base de datos ni levantan servidores.
- Usan imágenes sintéticas en memoria (numpy) para ejercitar el pipeline offline.

Ejecutar (desde backend_api/):
    python -m pytest tests/ -q
"""
import json

import cv2
import numpy as np
import pytest

from services.motor_ia import (
    ClaudeGridOCRService,
    Grid5x5Engine,
    build_full_rectangle_prompt,
    enforce_x_exclusivity,
    rotate_warped_for_human_reading,
)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _fake_25_cells_response(tablilla_id="T1"):
    """Respuesta mock con exactamente 25 celdas F1C1..F5C5 (sin red)."""
    cells = []
    for fila in range(1, 6):
        for col in range(1, 6):
            if col in (3, 4):
                valor = "X" if (col == 3 and fila % 2 == 1) else ""
            elif col == 5 and fila == 5:
                valor = "10"
            else:
                valor = str((fila + col) % 9)
            cells.append({"fila": fila, "col": col, "valor": valor, "confianza": 0.9})
    return json.dumps({"tablilla_id": tablilla_id, "cells": cells})


def _img_with_red_quad(w, h, pts):
    """Imagen gris clara con 4 puntos rojos (BGR) en las posiciones dadas."""
    img = np.full((h, w, 3), 230, dtype=np.uint8)
    for (x, y) in pts:
        cv2.circle(img, (x, y), 14, (0, 0, 255), -1)
    return img


@pytest.fixture
def img_bytes():
    """Imagen sintética PNG en memoria (sin puntos rojos -> build_grid usa fallback)."""
    img = np.full((250, 180, 3), 200, dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


# ── 1. Rotación / orientación ─────────────────────────────────────────────────
def test_rotation_produces_wide_readable_rectangle():
    # `warped` actual queda vertical (alto > ancho).
    warped_tall = np.zeros((300, 120, 3), dtype=np.uint8)
    readable = rotate_warped_for_human_reading(warped_tall)
    # Tras rotar 90° horario, el rectángulo legible queda apaisado: ancho > alto.
    assert readable.shape[1] > readable.shape[0]


# ── 2. Prompt contiene reglas de filas/columnas y restricciones C3/C4 ─────────
def test_full_rectangle_prompt_contains_rules():
    p = build_full_rectangle_prompt()
    assert "fila 1 a fila 5" in p
    assert "columna 1 a columna 5" in p
    assert "ARRIBA hacia ABAJO" in p
    assert "IZQUIERDA a DERECHA" in p
    for col in ("C1", "C2", "C3", "C4", "C5"):
        assert col in p
    assert "booleana" in p
    assert '"X"' in p
    assert "figura cerrada" in p
    assert "SUMA todo" in p
    assert "25 celdas" in p
    assert "SOLO JSON" in p


# ── 3. Parsing/normalización con respuesta mock de 25 celdas (modo explícito) ─
def test_full_rectangle_parsing_and_normalization(img_bytes, monkeypatch):
    svc = ClaudeGridOCRService()
    fake = _fake_25_cells_response()
    monkeypatch.setattr(svc, "_call_claude_full_rectangle", lambda *a, **k: fake)

    result = svc.procesar_imagen(img_bytes, ocr_mode="full_rectangle")

    assert len(result["matriz"]) == 25
    assert result["debug"]["ocr_mode"] == "full_rectangle"
    assert result["status"].startswith("procesado_ia_full_rectangle")
    assert "full_rectangle_b64" in result["debug"]
    assert "raw_full_rectangle_output" in result["debug"]
    assert "full_rectangle_model" in result["debug"]

    required_keys = {"fila", "col", "valor", "valor_original", "confianza", "ref_id", "recorte_b64"}
    for celda in result["matriz"]:
        assert required_keys.issubset(celda.keys())

    for celda in result["matriz"]:
        if celda["col"] in (2, 3):  # C3, C4 (índices 2 y 3)
            assert celda["valor"] in ("X", "")
        else:  # C1, C2, C5
            assert celda["valor"] == "" or celda["valor"].isdigit()


# ── 4. Fallback: JSON inválido en full_rectangle -> camino segmentado ─────────
def test_invalid_full_rectangle_falls_back_to_segmented(img_bytes, monkeypatch):
    svc = ClaudeGridOCRService()
    calls = {"full_rectangle": 0, "segmented": 0, "audit": 0}

    def fake_full_rectangle(*a, **k):
        calls["full_rectangle"] += 1
        return "esto no es json valido {"

    def fake_segmented(*a, **k):
        calls["segmented"] += 1
        return _fake_25_cells_response()

    def fake_audit(*a, **k):
        calls["audit"] += 1
        return ('{"counts": []}', "mock-audit-model")

    monkeypatch.setattr(svc, "_call_claude_full_rectangle", fake_full_rectangle)
    monkeypatch.setattr(svc, "_call_claude", fake_segmented)
    monkeypatch.setattr(svc, "_call_count_audit", fake_audit)

    result = svc.procesar_imagen(img_bytes, ocr_mode="full_rectangle")

    assert calls["full_rectangle"] == 1
    assert calls["segmented"] == 1
    assert result["debug"]["ocr_mode"] == "segmented"
    assert len(result["matriz"]) == 25
    assert result["status"].startswith("procesado_ia_tablilla")


# ── 5. Fallback robusto: sin warp confiable se lee la imagen COMPLETA ─────────
#    (no se trocea a ciegas — esta era la causa de los fallbacks malos)
def test_segmented_fallback_uses_whole_image_read(img_bytes, monkeypatch):
    svc = ClaudeGridOCRService()
    blind_called = {"n": 0}

    monkeypatch.setattr(svc, "_call_claude_full_rectangle", lambda *a, **k: _fake_25_cells_response())

    def blind(*a, **k):
        blind_called["n"] += 1
        return _fake_25_cells_response()

    monkeypatch.setattr(svc, "_call_claude", blind)
    monkeypatch.setattr(svc, "_call_count_audit", lambda *a, **k: ('{"counts": []}', "m"))

    result = svc.procesar_imagen(img_bytes)  # modo segmentado por defecto; gris => warp fallback

    assert result["debug"]["ocr_mode"] == "full_rectangle_fallback"
    assert result["status"] == "procesado_ia_tablilla_fallback"
    assert len(result["matriz"]) == 25
    assert blind_called["n"] == 0  # NO se troceó a ciegas


# ── 6. Si la lectura completa también falla, recién ahí se trocea (último recurso) ─
def test_segmented_fallback_invalid_whole_image_falls_to_blind(img_bytes, monkeypatch):
    svc = ClaudeGridOCRService()
    fr = {"n": 0}
    blind = {"n": 0}

    def fr_call(*a, **k):
        fr["n"] += 1
        return "no json {"

    def blind_call(*a, **k):
        blind["n"] += 1
        return _fake_25_cells_response()

    monkeypatch.setattr(svc, "_call_claude_full_rectangle", fr_call)
    monkeypatch.setattr(svc, "_call_claude", blind_call)
    monkeypatch.setattr(svc, "_call_count_audit", lambda *a, **k: ('{"counts": []}', "m"))

    result = svc.procesar_imagen(img_bytes)

    assert fr["n"] == 1          # intentó leer la imagen completa
    assert blind["n"] == 1       # y solo entonces troceó
    assert result["debug"]["ocr_mode"] == "segmented"
    assert result["status"] == "procesado_ia_tablilla_fallback"


# ── 7. Warp: acepta cuadrilátero apaisado y RECHAZA el degenerado ────────────
def test_warp_accepts_landscape_quad():
    eng = Grid5x5Engine()
    img = _img_with_red_quad(700, 400, [(50, 60), (650, 60), (650, 340), (50, 340)])
    warped, maxW, maxH, _rect, status = eng.warp(img)
    assert warped is not None
    assert status == "ok"
    assert maxW / maxH >= 0.95


def test_warp_rejects_degenerate_quad():
    # Puntos que forman un cuadrilátero vertical y angosto (selección errónea típica).
    eng = Grid5x5Engine()
    img = _img_with_red_quad(300, 700, [(60, 50), (240, 50), (240, 650), (60, 650)])
    warped, _maxW, _maxH, _rect, status = eng.warp(img)
    assert warped is None
    assert "degenerado" in status


# ── 8. Regla de negocio: C3 y C4 son excluyentes por fila (máx. una X) ───────
def test_enforce_x_exclusivity_keeps_higher_confidence():
    matriz = [
        {"ref_id": "F1C3", "col": 2, "valor": "X", "valor_original": "X", "confianza": 0.60},
        {"ref_id": "F1C4", "col": 3, "valor": "X", "valor_original": "X", "confianza": 0.90},
        {"ref_id": "F2C3", "col": 2, "valor": "X", "valor_original": "X", "confianza": 0.95},
        {"ref_id": "F2C4", "col": 3, "valor": "",  "valor_original": "",  "confianza": 0.90},
    ]
    enforce_x_exclusivity(matriz)
    by = {m["ref_id"]: m for m in matriz}
    # Fila 1: doble X -> conserva C4 (0.90 > 0.60), limpia C3
    assert by["F1C3"]["valor"] == ""
    assert by["F1C4"]["valor"] == "X"
    # Fila 2: una sola X -> intacta
    assert by["F2C3"]["valor"] == "X"
    assert by["F2C4"]["valor"] == ""


def _response_with_double_x():
    cells = []
    for fila in range(1, 6):
        for col in range(1, 6):
            if fila == 1 and col == 3:
                cells.append({"fila": 1, "col": 3, "valor": "X", "confianza": 0.60})
            elif fila == 1 and col == 4:
                cells.append({"fila": 1, "col": 4, "valor": "X", "confianza": 0.95})
            elif col in (3, 4):
                cells.append({"fila": fila, "col": col, "valor": "", "confianza": 0.9})
            else:
                cells.append({"fila": fila, "col": col, "valor": "1", "confianza": 0.9})
    return json.dumps({"tablilla_id": "T1", "cells": cells})


def test_x_exclusivity_enforced_end_to_end(img_bytes, monkeypatch):
    svc = ClaudeGridOCRService()
    monkeypatch.setattr(svc, "_call_claude_full_rectangle", lambda *a, **k: _response_with_double_x())

    result = svc.procesar_imagen(img_bytes, ocr_mode="full_rectangle")

    by = {m["ref_id"]: m for m in result["matriz"]}
    # Tras la regla, la fila 1 ya no puede tener X en C3 y C4 a la vez
    assert [by["F1C3"]["valor"], by["F1C4"]["valor"]].count("X") == 1
    assert by["F1C4"]["valor"] == "X"   # se conservó la de mayor confianza
    assert by["F1C3"]["valor"] == ""
