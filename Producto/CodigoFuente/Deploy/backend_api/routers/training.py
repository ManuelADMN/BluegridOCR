from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from services.db import get_connection
from services.timezone import app_now_naive
from dependencies.auth import require_roles
from core.logger import logger

router = APIRouter(tags=["Training"])


class CorrectionItem(BaseModel):
    ref_id: str
    valor_original: str
    valor_corregido: str
    recorte_b64: Optional[str] = None


class FeedbackPayload(BaseModel):
    id_registro: int
    zona_id: Optional[int] = None
    correcciones: List[CorrectionItem]


@router.post("/training/feedback")
def guardar_feedback(
    payload: FeedbackPayload,
    current_user: dict = Depends(require_roles(["admin", "supervisor", "buzo"]))
):
    usuario_id = int(current_user["id"])
    logger.info("[TRAINING] ── Recibiendo feedback ──────────────────────────")
    logger.info("[TRAINING] usuario=%s (id=%d)  id_registro=%d  correcciones_enviadas=%d",
                current_user["username"], usuario_id, payload.id_registro, len(payload.correcciones))

    # Solo guardar celdas donde el valor fue efectivamente corregido
    cambios = [c for c in payload.correcciones if c.valor_original != c.valor_corregido]
    if not cambios:
        logger.info("[TRAINING] Sin cambios reales detectados, nada que guardar")
        return {"guardados": 0, "mensaje": "Sin cambios detectados"}

    logger.info("[TRAINING] Cambios a guardar: %d  refs=%s",
                len(cambios), [c.ref_id for c in cambios])

    conn = get_connection()
    guardados = 0
    try:
        cur = conn.cursor()
        ahora = app_now_naive()
        for item in cambios:
            tiene_imagen = bool(item.recorte_b64)
            logger.debug("[TRAINING]   → ref_id=%s  '%s' → '%s'  imagen=%s",
                         item.ref_id, item.valor_original, item.valor_corregido,
                         "SI" if tiene_imagen else "NO")
            cur.execute(
                """
                INSERT INTO feedback_ia
                    (fk_usuario, fk_registro, fk_sector, ref_id,
                     valor_original, valor_corregido, recorte_base64, fecha_feedback)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    usuario_id,
                    payload.id_registro,
                    payload.zona_id,
                    item.ref_id,
                    item.valor_original,
                    item.valor_corregido,
                    item.recorte_b64,
                    ahora,
                ),
            )
            guardados += 1
        conn.commit()
        cur.close()
        conn.close()
        logger.info("[TRAINING] Feedback guardado en Supabase: %d correcciones", guardados)
        logger.info("[TRAINING] ────────────────────────────────────────────────")
        return {"guardados": guardados, "mensaje": f"{guardados} correcciones guardadas"}
    except Exception as e:
        conn.rollback()
        conn.close()
        logger.exception("[TRAINING] Error al guardar feedback")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/training/excepciones/{usuario_id}")
def obtener_excepciones(
    usuario_id: int,
    current_user: dict = Depends(require_roles(["admin", "supervisor", "buzo"]))
):
    """Devuelve las últimas correcciones de un buzo para usarlas como contexto OCR."""
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
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
