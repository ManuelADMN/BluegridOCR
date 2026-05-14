
import ast
import base64
import json
import os
import re
import time
from io import BytesIO

import cv2
import numpy as np
from PIL import Image, ImageDraw
import anthropic
from core.config import settings
from core.logger import logger

CLAUDE_MODEL = settings.ANTHROPIC_MODEL
CLAUDE_OCR_AUDIT_MODEL = settings.ANTHROPIC_OCR_AUDIT_MODEL

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
            logger.warning("[MOTOR_IA] warp: No se detectaron 4 puntos rojos → usando fallback sin warping")
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
        h0, w0 = img.shape[:2]
        logger.info("[MOTOR_IA] build_grid: imagen entrada %dx%d", w0, h0)
        warped, maxW, maxH, rect, status = self.warp(img)
        fallback = False

        if warped is None:
            fallback = True
            warped = img.copy()
            maxH, maxW = warped.shape[:2]
            logger.info("[MOTOR_IA] build_grid: FALLBACK activado (sin puntos rojos)")
        else:
            logger.info("[MOTOR_IA] build_grid: warping OK → %dx%d  status=%s", maxW, maxH, status)

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

        logger.info("[MOTOR_IA] build_grid: %d recortes generados (fallback=%s)", len(crops), fallback)
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

    # Solo remover tinta azul saturada de la grilla/textos.
    # El plastico celeste de fondo tiene dominancia azul, pero baja saturacion;
    # si lo removemos, desaparecen tambien los trazos de grafito.
    m1 = ((h >= 88) & (h <= 138) & (s >= 85) & (v >= 35))
    m2 = ((s >= 65) & (b > g + 24) & (b > r + 36) & (b > 70))

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
    Centra el recorte preservando la imagen real.
    No se blanquea azul aqui: hacerlo sobre el plastico celeste puede borrar grafito.
    """
    cell_w, cell_h = cell_size

    if crop is None or getattr(crop, "size", 0) == 0:
        return np.full((cell_h, cell_w, 3), 255, dtype=np.uint8)

    proc = crop.copy()
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


def _prepare_ink_crop_for_model(crop, cell_size=(240, 200), pad=12):
    """
    Vista auxiliar: extrae trazos oscuros de baja saturacion (grafito) y reduce grilla azul.
    No reemplaza la vista real; solo ayuda a contar palitos.
    """
    if crop is None or getattr(crop, "size", 0) == 0:
        return np.full((cell_size[1], cell_size[0], 3), 255, dtype=np.uint8)

    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]

    ink = ((v < 145) & (s < 125)) | (gray < 85)
    ink = ink.astype(np.uint8) * 255

    # Los recortes conservan parte del marco azul. En la vista auxiliar, ese marco
    # puede quedar negro por sombras/compresion; lo anulamos para no contar bordes.
    h, w = ink.shape[:2]
    mx = max(2, int(round(w * 0.055)))
    my = max(2, int(round(h * 0.12)))
    ink[:my, :] = 0
    ink[h - my:, :] = 0
    ink[:, :mx] = 0
    ink[:, w - mx:] = 0

    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8), iterations=1)
    ink = cv2.dilate(ink, np.ones((2, 2), np.uint8), iterations=1)

    extracted = np.full_like(crop, 255)
    extracted[ink > 0] = (0, 0, 0)
    return _prepare_crop_for_model(extracted, cell_size=cell_size, pad=pad)


def _inner_crop(crop, x_ratio=0.08, y_ratio=0.12):
    if crop is None or getattr(crop, "size", 0) == 0:
        return crop
    h, w = crop.shape[:2]
    mx = min(max(1, int(round(w * x_ratio))), max(1, w // 4))
    my = min(max(1, int(round(h * y_ratio))), max(1, h // 4))
    if h - 2 * my <= 4 or w - 2 * mx <= 4:
        return crop
    return crop[my:h - my, mx:w - mx].copy()


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


def build_ink_contact_sheet(crops, cell_size=(240, 200), pad=16):
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
        draw.text((x + 4, y + 2), f"INK {item['ref_id']}", fill=(0, 0, 0))

        if item["col"] in (3, 4):
            clean = _prepare_crop_for_model(item["crop"], cell_size=cell_size, pad=12)
        else:
            clean = _prepare_ink_crop_for_model(item["crop"], cell_size=cell_size, pad=12)
        pil = Image.fromarray(cv2.cvtColor(clean, cv2.COLOR_BGR2RGB))
        canvas.paste(pil, (x, y + title_h))
        draw.rectangle([x, y + title_h, x + cell_w - 1, y + title_h + cell_h - 1], outline=(180, 180, 180), width=1)

    out = BytesIO()
    canvas.save(out, format="PNG")
    return base64.b64encode(out.getvalue()).decode("utf-8")


def build_count_contact_sheet(crops, cell_size=(360, 260), pad=18):
    count_cols = [1, 2, 5]
    cell_w, cell_h = cell_size
    title_h = 30
    rows, cols = 5, len(count_cols)
    canvas_w = cols * cell_w + (cols + 1) * pad
    canvas_h = rows * (cell_h + title_h) + (rows + 1) * pad

    canvas = Image.new("RGB", (canvas_w, canvas_h), "white")
    draw = ImageDraw.Draw(canvas)
    by_key = {(item["fila"], item["col"]): item for item in crops}

    for r in range(1, rows + 1):
        for ci, col in enumerate(count_cols):
            item = by_key.get((r, col))
            x = pad + ci * cell_w
            y = pad + (r - 1) * (cell_h + title_h)
            label = f"CONTEO F{r}C{col}"
            draw.text((x + 4, y + 2), label, fill=(0, 0, 0))

            crop = item["crop"] if item else None
            clean = _prepare_crop_for_model(crop, cell_size=cell_size, pad=10)
            pil = Image.fromarray(cv2.cvtColor(clean, cv2.COLOR_BGR2RGB))
            canvas.paste(pil, (x, y + title_h))
            draw.rectangle(
                [x, y + title_h, x + cell_w - 1, y + title_h + cell_h - 1],
                outline=(180, 180, 180),
                width=1,
            )

    out = BytesIO()
    canvas.save(out, format="PNG")
    return base64.b64encode(out.getvalue()).decode("utf-8")


def build_count_legend_sheet():
    canvas = Image.new("RGB", (900, 260), "white")
    draw = ImageDraw.Draw(canvas)
    examples = [
        ("1", [(20, 150, 70, 150)]),
        ("2", [(135, 175, 135, 95), (135, 95, 205, 95)]),
        ("3", [(250, 85, 250, 175), (250, 175, 320, 175), (320, 175, 320, 85)]),
        ("4", [(365, 85, 445, 85), (445, 85, 445, 175), (445, 175, 365, 175), (365, 175, 365, 85)]),
        ("5", [(495, 85, 575, 85), (575, 85, 575, 175), (575, 175, 495, 175), (495, 175, 495, 85), (495, 175, 575, 85)]),
        ("8", [(625, 85, 705, 85), (705, 85, 705, 175), (705, 175, 625, 175), (625, 175, 625, 85), (625, 175, 705, 85), (735, 95, 770, 95), (735, 130, 770, 130), (735, 165, 770, 165)]),
    ]
    for label, segments in examples:
        draw.text((segments[0][0], 20), f"valor {label}", fill=(0, 0, 0))
        for seg in segments:
            draw.line(seg, fill=(20, 20, 20), width=8)
    draw.text((20, 220), "Cuenta lados/palitos oscuros. Figuras separadas se suman. Las columnas C3 y C4 no usan esta regla: solo X o vacio.", fill=(0, 0, 0))
    out = BytesIO()
    canvas.save(out, format="PNG")
    return base64.b64encode(out.getvalue()).decode("utf-8")


def build_count_audit_sheet(crops, cell_size=(420, 240), pad=18):
    count_cols = [1, 2, 5]
    cell_w, cell_h = cell_size
    title_h = 34
    strip_h = 34
    rows, cols = 5, len(count_cols)
    panel_h = cell_h * 2 + title_h + strip_h
    canvas_w = cols * cell_w + (cols + 1) * pad
    canvas_h = rows * panel_h + (rows + 1) * pad

    canvas = Image.new("RGB", (canvas_w, canvas_h), "white")
    draw = ImageDraw.Draw(canvas)
    by_key = {(item["fila"], item["col"]): item for item in crops}

    for r in range(1, rows + 1):
        for ci, col in enumerate(count_cols):
            item = by_key.get((r, col))
            x = pad + ci * cell_w
            y = pad + (r - 1) * panel_h

            draw.rectangle([x, y, x + cell_w - 1, y + panel_h - pad // 2], outline=(160, 160, 160), width=2)
            draw.text((x + 10, y + 8), f"AUDITAR F{r}C{col}  |  AZUL = 0  |  SUMAR FIGURAS", fill=(0, 0, 0))

            crop = item["crop"] if item else None
            raw = _prepare_crop_for_model(crop, cell_size=(cell_w - 20, cell_h), pad=6)
            inner = _prepare_crop_for_model(_inner_crop(crop), cell_size=(cell_w - 20, cell_h), pad=6)

            raw_pil = Image.fromarray(cv2.cvtColor(raw, cv2.COLOR_BGR2RGB))
            inner_pil = Image.fromarray(cv2.cvtColor(inner, cv2.COLOR_BGR2RGB))
            canvas.paste(raw_pil, (x + 10, y + title_h))
            canvas.paste(inner_pil, (x + 10, y + title_h + cell_h))

            draw.text(
                (x + 10, y + title_h + cell_h * 2 + 6),
                "Regla: cerrado=4, cerrado+linea=5, U/N/C=3, L=2, linea=1; todo se suma.",
                fill=(0, 0, 0),
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


def normalize_cell_value(value, col: int) -> str:
    """
    Mantiene el contrato actual: C1/C2/C5 solo enteros; C3/C4 solo X o vacio.
    """
    raw = str(value or "").strip().upper()
    raw = raw.replace("*", "X")

    if col in (3, 4):
        return "X" if "X" in raw else ""

    digits = "".join(ch for ch in raw if ch.isdigit())
    if digits:
        return str(int(digits))

    word_numbers = {
        "CERO": "0",
        "VACIO": "",
        "VACIA": "",
        "UNO": "1",
        "DOS": "2",
        "TRES": "3",
        "CUATRO": "4",
        "CINCO": "5",
        "SEIS": "6",
        "SIETE": "7",
        "OCHO": "8",
        "NUEVE": "9",
        "DIEZ": "10",
    }
    return word_numbers.get(raw, "")


def normalize_confidence(value) -> float:
    try:
        if isinstance(value, str):
            value = value.strip().replace(",", ".")
        confidence = float(value or 0.0)
    except Exception:
        confidence = 0.0
    return max(0.0, min(1.0, confidence))


def normalize_tablilla_id(value) -> str:
    raw = str(value or "").strip().upper()
    if not raw:
        return ""
    raw = raw.replace("TABLILLA", "TAB").replace("TABLA", "TAB")
    raw = re.sub(r"\s+", "", raw)
    raw = raw.replace("_", "-")
    match = re.search(r"(?:^|[^A-Z0-9])(?:T|TAB)?-?(\d+[A-Z]?)$", raw)
    if match:
        return match.group(1)
    match = re.search(r"(?:T|TAB)-?(\d+[A-Z]?)", raw)
    if match:
        return match.group(1)
    return re.sub(r"[^A-Z0-9-]", "", raw)


def build_prompt():
    return """
Eres un lector visual de tablillas acuicolas Bluegrid. Tu unica tarea es transcribir una grilla fija de 5 filas x 5 columnas.

Recibiras seis imagenes:
1. Imagen original completa: usala solo para contexto y para leer el identificador fisico de tablilla, por ejemplo T1.
2. Imagen rectificada de la tablilla: usala para entender filas, columnas y orientacion.
3. Plancha de recortes reales: es la fuente principal. Contiene 25 celdas ya separadas y rotuladas F1C1 a F5C5.
4. Plancha auxiliar INK: muestra trazos oscuros probables en columnas de conteo. Usala como ayuda para contar palitos, pero si contradice la plancha real, manda la plancha real.
5. Plancha CONTEO: muestra mas grandes solo las columnas C1, C2 y C5. Usala como fuente principal para contar segmentos.
6. Leyenda de conteo: muestra ejemplos visuales de cuanto vale cada figura.

Columnas de la grilla:
C1 = Nidos con huevos
C2 = Cuevas cubiertas
C3 = Captura hembra en nido
C4 = Captura hembra en cueva
C5 = Total pulpos

Prioridad de lectura:
- Decide cada valor mirando primero el recorte etiquetado de la plancha real.
- Para C1, C2 y C5 revisa tambien la plancha CONTEO porque esta ampliada.
- Usa la plancha auxiliar INK solo para confirmar trazos de grafito debiles o borrosos en C1, C2 y C5.
- Usa la imagen rectificada solo para resolver dudas de contexto.
- Usa la imagen original solo para el identificador lateral y para confirmar orientacion. El identificador puede estar rotado 90, 180 o 270 grados; mentalmente rota la imagen si hace falta antes de leerlo.

Reglas criticas:
- Cuenta SOLO trazos oscuros de lapiz/grafito dentro de cada celda.
- Ignora por completo lineas azules, bordes azules, marco azul, letras azules, puntos rojos y sombras.
- No cuentes el borde de la celda como parte del numero.
- No cuentes manchas de madera, reflejos, suciedad, ruido de compresion ni sombra.
- Si una marca toca el borde azul, cuenta solo la parte oscura que corresponde a lapiz.
- Si una celda esta vacia o no tiene trazos oscuros internos, devuelve "".
- No inventes valores para completar una fila.

Como convertir marcas a numero en C1, C2 y C5:
- Estas columnas NO contienen digitos escritos. Contienen conteos por palitos/segmentos.
- No interpretes estas marcas como letras ni numeros manuscritos. Debes contar segmentos.
- El numero es la suma de palitos oscuros visibles dentro de la celda.
- Un palito es un trazo oscuro: horizontal, vertical o diagonal. Cuenta cada segmento, aunque este curvo por perspectiva, inclinado o unido a otro.
- Si un trazo cambia de direccion y forma una esquina, separa sus lados y cuenta cada lado visible.
- Dos palitos significan "2" en cualquier forma: una L, una V, un angulo, dos verticales, etc.
- Tres palitos significan "3" en cualquier forma: U, C, N, puente, tres trazos separados, etc.
- Un cuadrado/rectangulo cerrado normalmente vale "4" porque tiene 4 lados.
- Un cuadrado completo con una linea interna central o diagonal vale "5".
- Si hay una figura y palitos aparte en la misma celda, suma todo. Ejemplo: cuadrado con diagonal + tres palitos aparte = "8".
- Si hay dos o mas figuras separadas dentro de una celda, cuenta cada figura y suma los valores. No tomes solo la figura mas grande.
- Si una celda parece tener "o", "0" o un cuadrado, eso NO es cero: es una figura cerrada y vale 4.
- Si una celda parece tener "n", "u", "U" o "C", eso NO es una letra: es una figura abierta de 3 lados y vale 3.
- Si ves algo parecido a "o n" o "cuadrado + n", suma 4 + 3 = "7"; si el cuadrado tiene diagonal/linea interna, suma 5 + 3 = "8".
- Si ves dos cuadrados o dos figuras cerradas, suma 4 + 4 = "8"; si alguna tiene linea interna, suma 5 por esa figura.
- Si ves dos figuras cerradas lado a lado y ambas tienen trazo interno/diagonal o estan repasadas por dentro, cuenta 5 + 5 = "10".
- Si dudas entre 9 y 10 porque una de las figuras cerradas parece tener trazo interno tenue, prefiere "10" con confianza moderada.
- Ejemplos: linea = "1"; L = "2"; U = "3"; cuadrado = "4"; cuadrado con linea central = "5"; cuadrado + linea = "5"; cuadrado + 2 palitos = "6"; cuadrado + 3 palitos = "7"; cuadrado con linea central + 3 palitos = "8".
- El resultado puede ser mayor a 5. No limites el conteo.
- Nunca respondas "X" en C1, C2 o C5.

Como leer C3 y C4:
- Estas dos columnas son siempre columnas de X: solo indican presencia/ausencia. Hay dos columnas X y ambas deben leerse como booleanas.
- Devuelve "X" si hay una X oscura clara dentro de la celda.
- Devuelve "" si no hay X oscura.
- No devuelvas numeros en C3 ni C4.
- Una diagonal sola, una sombra o una parte del borde no son X.

Checklist obligatorio antes de responder:
1. Verifica que hay exactamente 25 celdas, todas las combinaciones F1C1..F5C5.
2. Lee el identificador fisico de la pestaña/lateral de la tablilla. Si ves T1, T-1, TAB1 o TAB-1, devuelve "1". Si ves T2, devuelve "2". Devuelve siempre el ID canonico sin prefijo T/TAB.
3. Verifica que C1, C2 y C5 solo tengan enteros positivos o "".
4. Verifica que C3 y C4 solo tengan "X" o "".
5. Si hay duda real en una celda, devuelve tu mejor lectura visible y usa confianza menor, entre 0.45 y 0.70.
6. Si no hay marca visible, devuelve "" con confianza alta.

Responde SOLO JSON valido, sin markdown, sin explicaciones, con esta forma exacta:
{
  "tablilla_id": "1",
  "cells": [
    {"fila": 1, "col": 1, "valor": "3", "confianza": 0.92},
    {"fila": 1, "col": 2, "valor": "4", "confianza": 0.93},
    {"fila": 1, "col": 3, "valor": "X", "confianza": 0.99},
    {"fila": 1, "col": 4, "valor": "", "confianza": 0.97},
    {"fila": 1, "col": 5, "valor": "2", "confianza": 0.91}
  ]
}
""".strip()


def build_audit_prompt():
    return """
Eres auditor visual de conteo para tablillas Bluegrid. Tu trabajo es corregir SOLO las columnas C1, C2 y C5.

Recibiras una plancha AUDITAR con 15 celdas: F1C1..F5C1, F1C2..F5C2 y F1C5..F5C5.
Cada celda aparece dos veces: arriba imagen real completa, abajo zoom interno que recorta bordes azules.

Regla absoluta:
- AZUL = 0. Lineas azules, esquinas azules, marco azul, bordes curvos y texto azul nunca cuentan.
- Rojo = 0. Puntos rojos nunca cuentan.
- Solo cuenta grafito/lapiz oscuro interno.
- No leas letras ni digitos manuscritos. Cuenta segmentos/palitos.

Valores:
- linea suelta = 1
- L, angulo o dos palitos = 2
- U, C, N o tres palitos = 3
- figura cerrada tipo cuadro/o/0 = 4
- figura cerrada con linea interna o diagonal = 5
- si hay dos figuras en la misma celda, suma ambas.
- si hay una figura mas palitos separados, suma todo.
- ejemplos criticos:
  - cuadro + N/U/C = 7
  - cuadro con diagonal + N/U/C = 8
  - dos cuadros cerrados = 8
  - dos cuadros con linea interna/diagonal = 10
  - cuadro con diagonal + cuadro cerrado = 9
- Cuando veas dos cuadrados pequenos en la misma celda y el segundo esta cerca de una esquina azul, NO ignores el segundo cuadrado: el azul vale 0, pero el grafito interno del cuadrado si cuenta.
- Si dudas entre 9 y 10 porque el segundo cuadrado tiene trazo interno tenue o esta parcialmente junto a la esquina azul, prefiere 10 con confianza moderada.

Compara con la matriz del primer pase que viene en el texto del usuario. Si el primer pase subconto, corrigelo.
Devuelve SOLO JSON valido con esta forma exacta:
{
  "counts": [
    {"fila": 1, "col": 1, "valor": "2", "confianza": 0.91},
    {"fila": 1, "col": 2, "valor": "4", "confianza": 0.91},
    {"fila": 1, "col": 5, "valor": "1", "confianza": 0.91}
  ]
}
""".strip()

class ClaudeGridOCRService:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.grid = Grid5x5Engine()

    def _call_claude(self, original_b64, warped_b64, sheet_b64, ink_sheet_b64, count_sheet_b64, legend_b64, excepciones=None):
        exc_count = 0
        logger.info("[MOTOR_IA] _call_claude: Preparando llamada a Claude modelo=%s", CLAUDE_MODEL)
        content = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": original_b64},
            },
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": warped_b64},
            },
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": sheet_b64},
            },
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": ink_sheet_b64},
            },
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": count_sheet_b64},
            },
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": legend_b64},
            },
        ]

        # Inyectar ejemplos de escritura del buzo si existen
        if excepciones:
            exc_con_imagen = [e for e in excepciones if e.get("recorte_b64")]
            exc_count = len(exc_con_imagen)
            if exc_con_imagen:
                logger.info("[MOTOR_IA] Inyectando %d ejemplos de escritura del buzo como contexto", exc_count)
                content.append({
                    "type": "text",
                    "text": (
                        "PATRON DE ESCRITURA DE ESTE BUZO (ejemplos reales corregidos por el operador): "
                        "Las siguientes imagenes muestran como escribe este buzo especifico. "
                        "Cada imagen va acompanada del valor correcto. "
                        "Si en la tablilla ves una forma similar, usa ese valor como referencia prioritaria."
                    ),
                })
                for exc in exc_con_imagen[:10]:
                    content.append({
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/png", "data": exc["recorte_b64"]},
                    })
                    content.append({
                        "type": "text",
                        "text": f"Esta forma significa: {exc['valor_corregido']} (el OCR lo leyo como {exc['valor_original']})",
                    })

        content.append({
            "type": "text",
            "text": (
                "Lee la tablilla completa desde la plancha real F1C1..F5C5 y devuelve SOLO el JSON exacto. "
                "Para C1, C2 y C5 usa especialmente la plancha CONTEO ampliada y la leyenda visual. "
                "Usa la plancha INK solo como apoyo para trazos debiles. "
                "En C1, C2 y C5 cuenta segmentos oscuros de grafito; no leas digitos manuscritos. "
                "En C3 y C4 solo marca X o vacio porque son columnas booleanas. "
                "Ignora completamente lineas azules, bordes, letras azules, puntos rojos, sombras y fondo."
            ),
        })

        logger.info("[MOTOR_IA] Llamando a Claude (pase 1/2)  modelo=%s  bloques_contenido=%d  excepciones_inyectadas=%d",
                    CLAUDE_MODEL, len(content), exc_count)
        t0 = time.time()
        response = self.client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2200,
            temperature=0,
            system=build_prompt(),
            messages=[{"role": "user", "content": content}],
        )
        elapsed = round(time.time() - t0, 2)
        resp_text = response.content[0].text if response.content else ""
        logger.info("[MOTOR_IA] Pase 1 completado en %.2fs  respuesta=%d chars  tokens_usados=%s",
                    elapsed, len(resp_text),
                    getattr(response, 'usage', None) and f"in={response.usage.input_tokens} out={response.usage.output_tokens}")
        return resp_text

    def _call_count_audit(self, audit_sheet_b64, first_pass_matrix):
        user_text = (
            "Primer pase normalizado para C1/C2/C5. Revisalo visualmente y corrige subconteos: "
            + json.dumps(first_pass_matrix, ensure_ascii=False)
        )

        def run(model):
            response = self.client.messages.create(
                model=model,
                max_tokens=1600,
                temperature=0,
                system=build_audit_prompt(),
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": audit_sheet_b64,
                                },
                            },
                            {"type": "text", "text": user_text},
                        ],
                    }
                ],
            )
            return response.content[0].text if response.content else ""

        try:
            return run(CLAUDE_OCR_AUDIT_MODEL), CLAUDE_OCR_AUDIT_MODEL
        except Exception:
            if CLAUDE_OCR_AUDIT_MODEL == CLAUDE_MODEL:
                raise
            return run(CLAUDE_MODEL), CLAUDE_MODEL

    def procesar_imagen(self, img_bytes, excepciones=None):
        logger.info("[MOTOR_IA] ══ Inicio procesamiento OCR ═══════════════════")
        logger.info("[MOTOR_IA] Tamaño imagen: %.1f KB  excepciones_buzo=%d",
                    len(img_bytes) / 1024, len(excepciones) if excepciones else 0)
        t_total = time.time()

        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            logger.error("[MOTOR_IA] No se pudo decodificar la imagen")
            return {
                "status": "error",
                "promedio_confianza": 0.0,
                "matriz": [],
                "mensaje": "No se pudo decodificar la imagen",
            }

        grid_data = self.grid.build_grid(img)

        original_model = img.copy()
        warped_model = grid_data["warped"].copy()
        original_b64 = cv2_to_b64(original_model)
        warped_b64 = cv2_to_b64(warped_model)
        sheet_b64 = build_contact_sheet(grid_data["crops"])
        ink_sheet_b64 = build_ink_contact_sheet(grid_data["crops"])
        count_sheet_b64 = build_count_contact_sheet(grid_data["crops"])
        legend_b64 = build_count_legend_sheet()

        raw = self._call_claude(original_b64, warped_b64, sheet_b64, ink_sheet_b64, count_sheet_b64, legend_b64, excepciones=excepciones)
        parsed = extract_json(raw)
        parsed["tablilla_id_raw"] = parsed.get("tablilla_id")
        parsed["tablilla_id"] = normalize_tablilla_id(parsed.get("tablilla_id"))
        logger.info("[MOTOR_IA] JSON parseado OK  tablilla_id_raw=%s  tablilla_id=%s  cells_raw=%d",
                    parsed.get("tablilla_id_raw"), parsed.get("tablilla_id"), len(parsed.get("cells", [])))

        cells = parsed.get("cells", [])
        by_key = {}
        for item in cells:
            try:
                fila = int(item.get("fila"))
                col = int(item.get("col"))
                by_key[(fila, col)] = item
            except Exception:
                pass

        crops_key = {(item["fila"], item["col"]): item["crop"] for item in grid_data["crops"]}

        matriz = []
        confidences = []

        for fila in range(1, 6):
            for col in range(1, 6):
                item = by_key.get((fila, col), {})
                valor = normalize_cell_value(item.get("valor", ""), col)
                confianza = normalize_confidence(item.get("confianza", 0.0))
                confidences.append(confianza)

                crop_raw = crops_key.get((fila, col))
                recorte_b64 = cv2_to_b64(_prepare_crop_for_model(crop_raw)) if crop_raw is not None else ""

                matriz.append({
                    "fila": f"Fila {fila}",
                    "col": col - 1,
                    "valor": valor,
                    "valor_original": valor,
                    "confianza": round(confianza, 4),
                    "ref_id": f"F{fila}C{col}",
                    "recorte_b64": recorte_b64,
                })

        promedio = round(float(sum(confidences) / len(confidences)), 4) if confidences else 0.0

        audit_sheet_b64 = build_count_audit_sheet(grid_data["crops"])
        audit_raw = ""
        audit_model = ""
        try:
            first_pass_counts = [
                {
                    "fila": int(item["fila"].split(" ")[1]),
                    "col": int(item["col"]) + 1,
                    "valor": item["valor"],
                }
                for item in matriz
                if int(item["col"]) + 1 in (1, 2, 5)
            ]
            audit_raw, audit_model = self._call_count_audit(audit_sheet_b64, first_pass_counts)
            audit_parsed = extract_json(audit_raw)
            for item in audit_parsed.get("counts", []):
                fila = int(item.get("fila", 0))
                col = int(item.get("col", 0))
                if fila < 1 or fila > 5 or col not in (1, 2, 5):
                    continue
                valor = normalize_cell_value(item.get("valor", ""), col)
                confianza = normalize_confidence(item.get("confianza", 0.0))
                idx = (fila - 1) * 5 + (col - 1)
                matriz[idx]["valor"] = valor
                matriz[idx]["valor_original"] = valor
                matriz[idx]["confianza"] = round(confianza, 4)
            promedio = round(
                float(sum(float(item.get("confianza", 0.0) or 0.0) for item in matriz) / len(matriz)),
                4,
            ) if matriz else promedio
        except Exception as exc:
            audit_raw = f"audit_skipped_or_failed: {exc}"

        status_final = "procesado_ia_tablilla" if not grid_data["fallback"] else "procesado_ia_tablilla_fallback"
        logger.info("[MOTOR_IA] Resultado final: status=%s  confianza=%.4f  tablilla_id=%s  celdas=%d  tiempo_total=%.2fs",
                    status_final, promedio, parsed.get("tablilla_id"), len(matriz), time.time() - t_total)
        logger.info("[MOTOR_IA] ═══════════════════════════════════════════════")
        return {
            "status": status_final,
            "promedio_confianza": promedio,
            "tablilla_id": parsed.get("tablilla_id"),
            "tablilla_id_raw": parsed.get("tablilla_id_raw"),
            "matriz": matriz,
            "debug": {
                "grid_preview_b64": cv2_to_b64(grid_data["preview"]),
                "warped_b64": warped_b64,
                "contact_sheet_b64": sheet_b64,
                "ink_contact_sheet_b64": ink_sheet_b64,
                "count_contact_sheet_b64": count_sheet_b64,
                "count_audit_sheet_b64": audit_sheet_b64,
                "grid_status": grid_data["status"],
                "fallback": grid_data["fallback"],
                "raw_model_output": raw,
                "audit_model": audit_model,
                "raw_audit_output": audit_raw,
            },
        }


_service = ClaudeGridOCRService()


def procesar_registro_ocr(img_bytes: bytes, excepciones=None):
    return _service.procesar_imagen(img_bytes, excepciones=excepciones)
