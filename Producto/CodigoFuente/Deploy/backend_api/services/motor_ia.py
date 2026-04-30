
import ast
import base64
import json
import os
from io import BytesIO

import cv2
import numpy as np
from PIL import Image, ImageDraw
import anthropic
from core.config import settings

CLAUDE_MODEL = "claude-3-5-sonnet-20241022"

COL_LABELS = [
    "N Nidos con Huevos",
    "N Cuevas Cubiertas",
    "Captura Hembras - Nido",
    "Captura Hembras - Cueva",
    "Captura N Total Pulpos",
]


class Grid5x5Engine:
    def __init__(self):
        self.lower_red1 = np.array([0, 120, 70], dtype=np.uint8)
        self.upper_red1 = np.array([10, 255, 255], dtype=np.uint8)
        self.lower_red2 = np.array([170, 120, 70], dtype=np.uint8)
        self.upper_red2 = np.array([180, 255, 255], dtype=np.uint8)

        # ratios base estables del OCR anterior
        self.default_x = [0.000, 0.318, 0.640, 0.751, 0.873, 1.000]
        self.default_y = [0.011, 0.199, 0.415, 0.629, 0.825, 1.000]

    def order_points(self, pts):
        rect = np.zeros((4, 2), dtype=np.float32)
        s = pts.sum(axis=1)
        diff = np.diff(pts, axis=1).flatten()
        rect[0] = pts[np.argmin(s)]     # tl
        rect[1] = pts[np.argmin(diff)]  # tr
        rect[2] = pts[np.argmax(s)]     # br
        rect[3] = pts[np.argmax(diff)]  # bl
        return rect

    def get_red_points(self, img):
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, self.lower_red1, self.upper_red1)
        mask |= cv2.inRange(hsv, self.lower_red2, self.upper_red2)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1)
        mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)

        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not cnts:
            return None

        H, W = img.shape[:2]
        min_area = max(12, int(H * W * 0.00003))

        centers = []
        for c in sorted(cnts, key=cv2.contourArea, reverse=True)[:12]:
            area = cv2.contourArea(c)
            if area < min_area:
                continue
            M = cv2.moments(c)
            if M["m00"] == 0:
                continue
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            centers.append([cx, cy])

        if len(centers) < 4:
            return None

        pts = np.array(centers, dtype=np.float32)
        corners = np.array([[0, 0], [W - 1, 0], [W - 1, H - 1], [0, H - 1]], dtype=np.float32)

        selected = []
        used = set()
        for corner in corners:
            d = np.sum((pts - corner) ** 2, axis=1)
            for idx in np.argsort(d):
                idx = int(idx)
                if idx not in used:
                    selected.append(pts[idx])
                    used.add(idx)
                    break

        if len(selected) != 4:
            return None

        return np.array(selected, dtype=np.float32)

    def warp(self, img, factor=1.517):
        pts = self.get_red_points(img)
        if pts is None:
            return None, None, None, None, "No se detectaron 4 puntos rojos"

        rect = self.order_points(pts)
        tl, tr, br, bl = rect

        wA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
        wB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
        maxW = max(int(round(wA)), int(round(wB)), 50)

        hA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
        hB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
        maxH = max(int(round(max(int(round(hA)), int(round(hB))) * factor)), 50)

        src = np.array([tl, tr, br, bl], dtype=np.float32)
        dst = np.array([[0, 0], [maxW - 1, 0], [maxW - 1, maxH - 1], [0, maxH - 1]], dtype=np.float32)

        M = cv2.getPerspectiveTransform(src, dst)
        warped = cv2.warpPerspective(img, M, (maxW, maxH))
        return warped, maxW, maxH, rect, "ok"

    def _norm_to_px(self, xs, total):
        out = [int(round(float(v) * float(total))) for v in xs]
        out[0] = 0
        out[-1] = total
        return out

    def _curve_row_factor(self, y_center, total_h):
        if total_h <= 0:
            return 0.0
        t = float(y_center) / float(total_h)
        curve_power = 1.55
        return t ** curve_power

    def _curved_xs_for_row(self, total_w, total_h, y1, y2):
        """
        Curvatura matemática estable:
        C3 y C4 se van hacia la izquierda al bajar.
        """
        base_x = list(self.default_x)

        # [borde izq, C1-C2, C2-C3, C3-C4, C4-C5, borde der]
        bottom_dx_ratios = [
            0.000,
            0.002,
            -0.018,
            -0.026,
            -0.014,
            0.002,
        ]

        y_center = (float(y1) + float(y2)) / 2.0
        f = self._curve_row_factor(y_center, total_h)

        xs = []
        for bx, dx in zip(base_x, bottom_dx_ratios):
            ratio = bx + f * dx
            ratio = max(0.0, min(1.0, ratio))
            xs.append(int(round(ratio * total_w)))

        xs[0] = 0
        xs[-1] = total_w

        fixed = [xs[0]]
        for v in xs[1:]:
            if v <= fixed[-1] + 4:
                v = fixed[-1] + 5
            fixed.append(min(v, total_w))

        fixed[-1] = total_w
        return fixed

    def build_grid(self, img):
        warped, maxW, maxH, rect, status = self.warp(img)
        fallback = False

        if warped is None:
            fallback = True
            warped = img.copy()
            maxH, maxW = warped.shape[:2]

        ys = self._norm_to_px(self.default_y, maxH)
        ys = [min(max(0, y), maxH) for y in ys]

        row_xs = []
        for r in range(5):
            y1 = ys[r]
            y2 = ys[r + 1]
            xs = self._curved_xs_for_row(maxW, maxH, y1, y2)
            row_xs.append(xs)

        crops = []
        for r in range(5):
            xs = row_xs[r]
            for c in range(5):
                x1, x2 = xs[c], xs[c + 1]
                y1, y2 = ys[r], ys[r + 1]

                x1 = max(0, min(x1, maxW - 1))
                x2 = max(0, min(x2, maxW))
                y1 = max(0, min(y1, maxH - 1))
                y2 = max(0, min(y2, maxH))

                if x2 <= x1:
                    x2 = min(maxW, x1 + 4)
                if y2 <= y1:
                    y2 = min(maxH, y1 + 4)

                crop = warped[y1:y2, x1:x2].copy()
                crops.append({
                    "fila": r + 1,
                    "col": c + 1,
                    "bbox": [int(x1), int(y1), int(x2), int(y2)],
                    "crop": crop,
                    "ref_id": f"F{r+1}C{c+1}",
                })

        preview = warped.copy()

        for y in ys:
            cv2.line(preview, (0, int(y)), (maxW - 1, int(y)), (0, 180, 0), 2)

        for r in range(5):
            xs = row_xs[r]
            y1 = int(ys[r])
            y2 = int(ys[r + 1])

            for x in xs:
                cv2.line(preview, (int(x), y1), (int(x), y2), (255, 0, 0), 2)

            for c in range(5):
                x1, x2 = int(xs[c]), int(xs[c + 1])
                cv2.rectangle(preview, (x1, y1), (x2, y2), (0, 180, 255), 1)
                cv2.putText(
                    preview,
                    f"F{r+1}C{c+1}",
                    (x1 + 6, min(y2 - 6, y1 + 22)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (20, 120, 255),
                    2,
                )

        return {
            "warped": warped,
            "preview": preview,
            "crops": crops,
            "fallback": fallback,
            "status": status,
        }


def cv2_to_b64(img):
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        return ""
    return base64.b64encode(buf).decode("utf-8")


def _blue_mask(img):
    """
    Detecta azul para blanquearlo SOLO en lo que ve Claude.
    No participa en la geometría.
    """
    if img is None or getattr(img, "size", 0) == 0:
        return np.zeros((1, 1), dtype=np.uint8)

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h = hsv[:, :, 0]
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]

    b = img[:, :, 0].astype(np.int16)
    g = img[:, :, 1].astype(np.int16)
    r = img[:, :, 2].astype(np.int16)

    m1 = ((h >= 88) & (h <= 138) & (s >= 40) & (v >= 20))
    m2 = ((b > g + 10) & (b > r + 12) & (b > 50))

    mask = np.where(m1 | m2, 255, 0).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1)
    return mask


def _whiten_blue_to_white(img):
    """
    Convierte azul a blanco SOLO para la vista del modelo.
    """
    if img is None or getattr(img, "size", 0) == 0:
        return img

    out = img.copy()
    mask = _blue_mask(out)
    out[mask > 0] = (255, 255, 255)
    return out


def _prepare_crop_for_model(crop, cell_size=(240, 200), pad=12):
    """
    Solo centra y blanquea azul a blanco.
    Sin brillo.
    """
    cell_w, cell_h = cell_size

    if crop is None or getattr(crop, "size", 0) == 0:
        return np.full((cell_h, cell_w, 3), 255, dtype=np.uint8)

    proc = _whiten_blue_to_white(crop.copy())
    canvas = np.full((cell_h, cell_w, 3), 255, dtype=np.uint8)

    h, w = proc.shape[:2]
    max_w = cell_w - 2 * pad
    max_h = cell_h - 2 * pad

    if h <= 0 or w <= 0 or max_w <= 0 or max_h <= 0:
        return canvas

    scale = min(max_w / float(w), max_h / float(h))
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))

    interp = cv2.INTER_CUBIC if scale >= 1 else cv2.INTER_AREA
    resized = cv2.resize(proc, (new_w, new_h), interpolation=interp)

    x = (cell_w - new_w) // 2
    y = (cell_h - new_h) // 2
    canvas[y:y+new_h, x:x+new_w] = resized
    return canvas


def build_contact_sheet(crops, cell_size=(240, 200), pad=16):
    cell_w, cell_h = cell_size
    title_h = 28
    rows, cols = 5, 5
    canvas_w = cols * cell_w + (cols + 1) * pad
    canvas_h = rows * (cell_h + title_h) + (rows + 1) * pad

    canvas = Image.new("RGB", (canvas_w, canvas_h), "white")
    draw = ImageDraw.Draw(canvas)

    for item in crops:
        r = item["fila"] - 1
        c = item["col"] - 1
        x = pad + c * cell_w
        y = pad + r * (cell_h + title_h)

        label = f"F{item['fila']}C{item['col']}"
        draw.text((x + 4, y + 2), label, fill=(0, 0, 0))

        clean = _prepare_crop_for_model(item["crop"], cell_size=cell_size, pad=12)
        pil = Image.fromarray(cv2.cvtColor(clean, cv2.COLOR_BGR2RGB))
        canvas.paste(pil, (x, y + title_h))

        draw.rectangle(
            [x, y + title_h, x + cell_w - 1, y + title_h + cell_h - 1],
            outline=(180, 180, 180),
            width=1
        )

    out = BytesIO()
    canvas.save(out, format="PNG")
    return base64.b64encode(out.getvalue()).decode("utf-8")


def extract_json(raw):
    """
    Parser robusto para respuestas reales del modelo.
    """
    raw = (raw or "").strip()
    if not raw:
        raise ValueError("Claude devolvió respuesta vacía")

    if raw.startswith("```"):
        raw = "\n".join(
            line for line in raw.splitlines()
            if not line.strip().startswith("```")
        ).strip()

    raw = (
        raw.replace("“", '"')
           .replace("”", '"')
           .replace("‘", "'")
           .replace("’", "'")
    )

    def first_balanced_object(s: str):
        start = s.find("{")
        if start == -1:
            return None

        depth = 0
        in_str = False
        str_char = None
        escape = False

        for i in range(start, len(s)):
            ch = s[i]

            if in_str:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == str_char:
                    in_str = False
                    str_char = None
                continue

            if ch in ("'", '"'):
                in_str = True
                str_char = ch
                continue

            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return s[start:i+1]

        return None

    candidate = first_balanced_object(raw)
    if candidate is None:
        raise ValueError(f"No se encontró objeto JSON en la respuesta: {raw[:800]}")

    try:
        return json.loads(candidate)
    except Exception:
        pass

    candidate2 = candidate.replace("\t", " ")
    candidate2 = candidate2.replace("\r", "")
    candidate2 = __import__("re").sub(r",\s*([}\]])", r"\1", candidate2)

    try:
        return json.loads(candidate2)
    except Exception:
        pass

    try:
        obj = ast.literal_eval(candidate2)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    candidate3 = candidate2
    candidate3 = __import__("re").sub(r"\bNone\b", "null", candidate3)
    candidate3 = __import__("re").sub(r"\bTrue\b", "true", candidate3)
    candidate3 = __import__("re").sub(r"\bFalse\b", "false", candidate3)

    try:
        return json.loads(candidate3)
    except Exception:
        pass

    raise ValueError(f"No se pudo parsear la respuesta del modelo. Primeros 1000 chars: {raw[:1000]}")


def build_prompt():
    return """
Eres un sistema OCR especializado en tablillas acuícolas con grilla fija 5x5.

Recibirás:
1. La imagen original completa, útil para leer tablilla_id.
2. La imagen rectificada (warped) para contexto general.
3. Una plancha con 25 recortes de celdas etiquetadas F1C1 a F5C5.

La grilla tiene 5 filas x 5 columnas:
1 = N Nidos con Huevos
2 = N Cuevas Cubiertas
3 = Captura Hembras - Nido
4 = Captura Hembras - Cueva
5 = Captura N Total Pulpos

REGLAS CRÍTICAS:
- Debes contar SOLO los trazos OSCUROS del lápiz/grafito dentro de la celda.
- Debes IGNORAR por completo las líneas azules de la grilla.
- NUNCA cuentes líneas azules, bordes azules ni marcos azules.
- Si una línea o borde se ve blanco o proviene de la grilla, no cuenta.
- Si una celda está vacía, aunque tenga marco o borde, devuelve "".
- No uses el color azul para inferir números ni X.

REGLAS DE LECTURA:
- Columnas 1, 2 y 5:
  Debes devolver el total numérico contando las figuras/trazos oscuros.
  Si hay más de una figura dentro de la celda, se suman.
  El resultado NO está limitado a 6.

  Ejemplos:
  - una línea = "1"
  - figura tipo L = "2"
  - figura tipo U / Π / C = "3"
  - cuadrado = "4"
  - cuadrado con diagonal = "5"
  - cuadrado con dos diagonales = "6"
  - cuadrado (4) + figura tipo Π (3) = "7"
  - cuadrado (4) + cuadrado con diagonal (5) = "9"
  - cuadrado con diagonal (5) + cuadrado con diagonal (5) = "10"

- Columnas 3 y 4:
  Solo puede ser:
  - "X"
  - ""

REGLAS ADICIONALES:
- Si hay duda, usa la mejor estimación visible y baja la confianza.
- No inventes datos.
- Debes devolver EXACTAMENTE 25 celdas.
- Ordena siempre por fila 1..5 y col 1..5.

Responde SOLO JSON válido con esta forma exacta:
{
  "tablilla_id": "T1",
  "cells": [
    {"fila": 1, "col": 1, "valor": "3", "confianza": 0.92},
    {"fila": 1, "col": 2, "valor": "4", "confianza": 0.93},
    {"fila": 1, "col": 3, "valor": "X", "confianza": 0.99},
    {"fila": 1, "col": 4, "valor": "", "confianza": 0.97},
    {"fila": 1, "col": 5, "valor": "2", "confianza": 0.91}
  ]
}
""".strip()


class ClaudeGridOCRService:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.grid = Grid5x5Engine()

    def _call_claude(self, original_b64, warped_b64, sheet_b64):
        response = self.client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2200,
            temperature=0,
            system=build_prompt(),
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": original_b64,
                            },
                        },
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": warped_b64,
                            },
                        },
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": sheet_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                "Lee la tablilla completa y devuelve SOLO el JSON exacto. "
                                "Ignora completamente las líneas azules y cualquier borde azul."
                            ),
                        },
                    ],
                }
            ],
        )
        return response.content[0].text if response.content else ""

    def procesar_imagen(self, img_bytes):
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {
                "status": "error",
                "promedio_confianza": 0.0,
                "matriz": [],
                "mensaje": "No se pudo decodificar la imagen",
            }

        grid_data = self.grid.build_grid(img)

        original_model = img.copy()
        warped_model = _whiten_blue_to_white(grid_data["warped"].copy())
        original_b64 = cv2_to_b64(original_model)
        warped_b64 = cv2_to_b64(warped_model)
        sheet_b64 = build_contact_sheet(grid_data["crops"])

        raw = self._call_claude(original_b64, warped_b64, sheet_b64)
        parsed = extract_json(raw)

        cells = parsed.get("cells", [])
        by_key = {}
        for item in cells:
            try:
                fila = int(item.get("fila"))
                col = int(item.get("col"))
                by_key[(fila, col)] = item
            except Exception:
                pass

        matriz = []
        confidences = []

        for fila in range(1, 6):
            for col in range(1, 6):
                item = by_key.get((fila, col), {})
                valor = str(item.get("valor", "") or "")
                confianza = float(item.get("confianza", 0.0) or 0.0)
                confianza = max(0.0, min(1.0, confianza))
                confidences.append(confianza)

                matriz.append({
                    "fila": f"Fila {fila}",
                    "col": col - 1,
                    "valor": valor,
                    "valor_original": valor,
                    "confianza": round(confianza, 4),
                    "ref_id": f"F{fila}C{col}",
                })

        promedio = round(float(sum(confidences) / len(confidences)), 4) if confidences else 0.0

        return {
            "status": "procesado_ia_tablilla" if not grid_data["fallback"] else "procesado_ia_tablilla_fallback",
            "promedio_confianza": promedio,
            "tablilla_id": parsed.get("tablilla_id"),
            "matriz": matriz,
            "debug": {
                "grid_preview_b64": cv2_to_b64(grid_data["preview"]),
                "warped_b64": warped_b64,
                "contact_sheet_b64": sheet_b64,
                "grid_status": grid_data["status"],
                "fallback": grid_data["fallback"],
                "raw_model_output": raw,
            },
        }


_service = ClaudeGridOCRService()


def procesar_registro_ocr(img_bytes: bytes):
    return _service.procesar_imagen(img_bytes)
