from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
import re
from services.motor_ia import procesar_registro_ocr
from services.db import get_connection
from services.timezone import app_now_naive
from dependencies.auth import require_roles
from core.logger import logger

router = APIRouter(tags=["Operaciones OCR"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024


def _parse_row_index(value) -> int | None:
    if isinstance(value, int):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    if text.isdigit():
        return int(text)
    match = re.search(r"fila\s*(\d+)", text, re.IGNORECASE)
    if match:
        return int(match.group(1)) - 1
    return None


def _detalles_desde_matriz(matriz: list) -> list[dict]:
    rows: dict[int, dict] = {}
    for cell in matriz or []:
        row_index = _parse_row_index(cell.get("fila"))
        if row_index is None or row_index < 0:
            continue
        row = rows.setdefault(
            row_index,
            {"fila_index": row_index, "n_nidos": 0, "n_cuevas": 0, "hembra": 0, "pulpos": 0},
        )
        col = int(cell.get("col") or 0)
        value = str(cell.get("valor") or "").strip()
        if col == 0:
            row["n_nidos"] = int(value) if value.isdigit() else 0
        elif col == 1:
            row["n_cuevas"] = int(value) if value.isdigit() else 0
        elif col == 2 and value.upper() == "X":
            row["hembra"] = 1
        elif col == 3 and value.upper() == "X":
            row["hembra"] = 2
        elif col == 4:
            row["pulpos"] = int(value) if value.isdigit() else 0
    return [rows[key] for key in sorted(rows)]


def _tablilla_candidates(value: str | None) -> list[str]:
    raw = str(value or "").strip().upper()
    if not raw:
        return []
    compact = re.sub(r"\s+", "", raw).replace("_", "-")
    compact = compact.replace("TABLILLA", "TAB").replace("TABLA", "TAB")
    match = re.search(r"(?:T|TAB)-?(\d+[A-Z]?)", compact)
    canonical = match.group(1) if match else re.sub(r"[^A-Z0-9-]", "", compact)
    values = [
        canonical,
        f"T{canonical}",
        f"T-{canonical}",
        f"TAB{canonical}",
        f"TAB-{canonical}",
    ]
    seen = set()
    return [item for item in values if item and not (item in seen or seen.add(item))]


def _resolver_tablilla_detectada(cur, tablilla_id: str | None) -> dict:
    candidates = _tablilla_candidates(tablilla_id)
    if not candidates:
        return {
            "tablilla_id_normalizado": None,
            "tablilla_encontrada": False,
            "tablilla": None,
            "embarcacion": None,
        }

    cur.execute(
        """
        SELECT
            t.id_tablilla,
            t.codigo_tablilla,
            t.fk_embarcacion,
            e.nombre_nave,
            e.matricula
        FROM tablillas t
        LEFT JOIN embarcaciones e ON e.id_embarcacion = t.fk_embarcacion
        WHERE UPPER(t.codigo_tablilla) = ANY(%s)
        ORDER BY t.id_tablilla ASC
        LIMIT 1
        """,
        ([candidate.upper() for candidate in candidates],),
    )
    row = cur.fetchone()
    if not row:
        return {
            "tablilla_id_normalizado": candidates[0],
            "tablilla_encontrada": False,
            "tablilla": None,
            "embarcacion": None,
        }

    return {
        "tablilla_id_normalizado": row[1],
        "tablilla_encontrada": True,
        "tablilla": {
            "id": row[0],
            "codigo": row[1],
        },
        "embarcacion": {
            "id": row[2],
            "nombre": row[3],
            "matricula": row[4],
        } if row[2] else None,
    }


def _ensure_tablilla_lookup_schema(cur):
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS tablillas (
            id_tablilla       SERIAL PRIMARY KEY,
            codigo_tablilla   TEXT NOT NULL UNIQUE,
            fk_embarcacion    INTEGER REFERENCES embarcaciones(id_embarcacion) ON DELETE RESTRICT,
            nombre_referencia TEXT,
            descripcion       TEXT,
            estado            TEXT DEFAULT 'ACTIVA',
            origen            TEXT DEFAULT 'ADMIN_PANEL',
            created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def _cargar_excepciones_buzo(usuario_id: int) -> list:
    """Consulta el historial de correcciones del buzo para inyectarlo como contexto al OCR."""
    logger.info("[OPERATIONS] Cargando excepciones de escritura para usuario_id=%d", usuario_id)
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT DISTINCT ON (ref_id, valor_corregido)
                ref_id, valor_original, valor_corregido, recorte_base64
            FROM feedback_ia
            WHERE fk_usuario = %s
              AND ref_id IS NOT NULL
              AND recorte_base64 IS NOT NULL
            ORDER BY ref_id, valor_corregido, fecha_feedback DESC
            LIMIT 20
            """,
            (usuario_id,),
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        logger.info("[OPERATIONS] Excepciones encontradas: %d para usuario_id=%d", len(rows), usuario_id)
        return [
            {
                "ref_id": r[0],
                "valor_original": r[1],
                "valor_corregido": r[2],
                "recorte_b64": r[3],
            }
            for r in rows
        ]
    except Exception as e:
        logger.warning("[OPERATIONS] No se pudieron cargar excepciones para usuario_id=%d: %s", usuario_id, e)
        try:
            conn.close()
        except Exception:
            pass
        return []


@router.post("/registros")
async def subir_registro(
    file: UploadFile = File(...),
    zona_id: int = Form(...),
    current_user: dict = Depends(require_roles(["admin", "supervisor", "buzo"]))
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Formato de imagen no permitido")

    contents = await file.read()
    file_kb = round(len(contents) / 1024, 1)

    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Imagen demasiado grande")

    try:
        usuario_id = int(current_user["id"])
        logger.info("[OPERATIONS] ── Nueva digitalización ──────────────────────")
        logger.info("[OPERATIONS] usuario=%s (id=%d)  zona_id=%d  imagen=%s  tamaño=%sKB",
                    current_user["username"], usuario_id, zona_id, file.filename, file_kb)

        # Cargar excepciones del buzo para mejorar precisión del OCR
        excepciones = _cargar_excepciones_buzo(usuario_id)
        logger.info("[OPERATIONS] Iniciando motor OCR (excepciones=%d)...", len(excepciones))

        resultado_ocr = procesar_registro_ocr(contents, excepciones=excepciones if excepciones else None)

        if resultado_ocr.get("status") == "error":
            logger.error("[OPERATIONS] OCR falló: %s", resultado_ocr.get("mensaje"))
            raise HTTPException(status_code=422, detail=resultado_ocr.get("mensaje", "Error OCR"))

        logger.info("[OPERATIONS] OCR completado: status=%s  confianza=%.2f  tablilla_id=%s  celdas=%d",
                    resultado_ocr.get("status"),
                    resultado_ocr.get("promedio_confianza", 0.0),
                    resultado_ocr.get("tablilla_id"),
                    len(resultado_ocr.get("matriz", [])))

        conn = get_connection()
        cur = conn.cursor()
        timestamp = app_now_naive()
        _ensure_tablilla_lookup_schema(cur)
        cur.execute("ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS fk_embarcacion INTEGER REFERENCES embarcaciones(id_embarcacion) ON DELETE SET NULL")
        cur.execute("ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS fk_tablilla INTEGER REFERENCES tablillas(id_tablilla) ON DELETE SET NULL")
        cur.execute("ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS tablilla_codigo_detectado TEXT")
        tablilla_meta = _resolver_tablilla_detectada(cur, resultado_ocr.get("tablilla_id"))
        resultado_ocr["tablilla_id"] = tablilla_meta.get("tablilla_id_normalizado") or resultado_ocr.get("tablilla_id")
        resultado_ocr["tablilla_detectada"] = tablilla_meta
        cur.execute(
            """
            INSERT INTO registros_ocr
            (
                fk_usuario_creador,
                fk_sector,
                fk_embarcacion,
                fk_tablilla,
                tablilla_codigo_detectado,
                url_imagen_original,
                promedio_confianza,
                estado_validacion,
                fecha_carga,
                updated_at
            )
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id_registro
            """,
            (
                usuario_id,
                zona_id,
                (tablilla_meta.get("embarcacion") or {}).get("id"),
                (tablilla_meta.get("tablilla") or {}).get("id"),
                resultado_ocr.get("tablilla_id"),
                "url_pendiente",
                float(resultado_ocr.get("promedio_confianza", 0.0)),
                "PENDIENTE_VALIDACION",
                timestamp,
                timestamp,
            )
        )
        nuevo_id = cur.fetchone()[0]

        detalles = _detalles_desde_matriz(resultado_ocr.get("matriz", []))
        for d in detalles:
            cur.execute(
                """
                INSERT INTO detalles_captura
                    (fk_registro, fila_index, n_nidos, n_cuevas_cubiertas,
                     captura_hembras_tipo, total_pulpos)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    nuevo_id,
                    d["fila_index"],
                    d["n_nidos"],
                    d["n_cuevas"],
                    d["hembra"],
                    d["pulpos"],
                ),
            )

        conn.commit()
        cur.close()
        conn.close()

        logger.info("[OPERATIONS] Registro guardado en BD: id_registro=%d  estado=PENDIENTE_VALIDACION  detalles=%d", nuevo_id, len(detalles))
        logger.info("[OPERATIONS] ─────────────────────────────────────────────")

        return {
            "id": nuevo_id,
            "id_registro": nuevo_id,
            "estado": "pendiente_validacion",
            "zona_id": zona_id,
            "usuario_id": usuario_id,
            "resultado_ia": resultado_ocr,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("[OPERATIONS] Error inesperado en subir_registro")
        raise HTTPException(status_code=500, detail=str(e))
