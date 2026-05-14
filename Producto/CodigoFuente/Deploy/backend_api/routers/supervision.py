from fastapi import APIRouter, HTTPException, Depends
from services.db import get_connection
from pydantic import BaseModel
from typing import List, Optional
from dependencies.auth import require_roles
from services.timezone import app_now_naive
from core.logger import logger

router = APIRouter(tags=["Supervision"])

class DetalleRow(BaseModel):
    fila_index: int
    n_nidos: int = 0
    n_cuevas: int = 0
    hembra: int = 0   # 0=ninguna, 1=nido, 2=cueva
    pulpos: int = 0

class ValidacionPayload(BaseModel):
    usuario_id: int = 1
    zona_id: int = 1
    tablilla_id: Optional[str] = None
    detalles: List[DetalleRow] = []
    comentarios: Optional[str] = None

class RechazoPayload(BaseModel):
    motivo: str


def set_app_context(cur, current_user: dict):
    cur.execute("SELECT set_config('app.user_id', %s, true)", (str(current_user.get("id") or ""),))
    cur.execute("SELECT set_config('app.email', %s, true)", (str(current_user.get("username") or ""),))
    cur.execute("SELECT set_config('app.role', %s, true)", (str(current_user.get("role") or ""),))
    cur.execute("SELECT set_config('app.source', %s, true)", ("bluegridocr_backend",))


def _normalize_detalles(detalles: List[DetalleRow]) -> list[DetalleRow]:
    normalized: dict[int, DetalleRow] = {}
    for detalle in detalles:
        if detalle.fila_index < 0:
            raise HTTPException(status_code=422, detail="fila_index debe ser mayor o igual a 0")
        normalized[detalle.fila_index] = detalle
    return [normalized[key] for key in sorted(normalized)]

@router.put("/registros/{registro_id}/validacion")
def validar_registro(
    registro_id: int,
    payload: ValidacionPayload,
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    logger.info("[SUPERVISION] ── Validando registro ──────────────────────────")
    logger.info("[SUPERVISION] registro_id=%d  usuario=%s  detalles_filas=%d  tablilla_id=%s",
                registro_id, current_user["username"], len(payload.detalles), payload.tablilla_id)
    conn = get_connection()
    try:
        cur = conn.cursor()
        set_app_context(cur, current_user)
        timestamp = app_now_naive()
        detalles = _normalize_detalles(payload.detalles)
        if not detalles:
            raise HTTPException(status_code=422, detail="No hay detalles para validar")

        cur.execute(
            """
            SELECT estado_validacion
            FROM registros_ocr
            WHERE id_registro=%s
            FOR UPDATE
            """,
            (registro_id,)
        )
        registro = cur.fetchone()
        if not registro:
            raise HTTPException(status_code=404, detail=f"Registro {registro_id} no encontrado")

        # 1. Marcar el registro como VALIDADO
        cur.execute(
            """
            UPDATE registros_ocr
            SET estado_validacion='VALIDADO',
                rechazo_motivo=NULL,
                validated_at=%s,
                validated_by=%s,
                updated_at=%s
            WHERE id_registro=%s
            """,
            (timestamp, int(current_user["id"]), timestamp, registro_id)
        )

        logger.info("[SUPERVISION] registros_ocr actualizado a VALIDADO")

        # 2. Actualizar detalles previos sin borrado fisico: la BDD protege la trazabilidad.
        for d in detalles:
            logger.debug("[SUPERVISION]   fila=%d  nidos=%d  cuevas=%d  hembra=%d  pulpos=%d",
                         d.fila_index, d.n_nidos, d.n_cuevas, d.hembra, d.pulpos)
            cur.execute(
                """
                UPDATE detalles_captura
                SET n_nidos = %s,
                    n_cuevas_cubiertas = %s,
                    captura_hembras_tipo = %s,
                    total_pulpos = %s,
                    updated_at = %s,
                    editado_por = %s
                WHERE fk_registro = %s
                  AND fila_index = %s
                """,
                (
                    d.n_nidos,
                    d.n_cuevas,
                    d.hembra,
                    d.pulpos,
                    timestamp,
                    int(current_user["id"]),
                    registro_id,
                    d.fila_index,
                )
            )
            if cur.rowcount == 0:
                cur.execute(
                    """
                    INSERT INTO detalles_captura
                        (fk_registro, fila_index, n_nidos, n_cuevas_cubiertas,
                         captura_hembras_tipo, total_pulpos, updated_at, editado_por)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        registro_id,
                        d.fila_index,
                        d.n_nidos,
                        d.n_cuevas,
                        d.hembra,
                        d.pulpos,
                        timestamp,
                        int(current_user["id"]),
                    )
                )

        conn.commit()
        logger.info("[SUPERVISION] detalles_captura guardados: %d filas", len(detalles))
        logger.info("[SUPERVISION] ────────────────────────────────────────────")
        return {"status": "ok", "id_registro": registro_id, "estado": "VALIDADO", "detalles": len(detalles)}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("[SUPERVISION] Error al validar registro_id=%d", registro_id)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.get("/registros/{registro_id}")
def obtener_registro(
    registro_id: int,
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT r.id_registro, r.fecha_carga, r.estado_validacion, r.promedio_confianza,
                   r.url_imagen_original, s.nombre_sector, s.region_chile,
                   COALESCE(u.nombre_completo, u.correo, 'Sin usuario') AS usuario,
                   r.rechazo_motivo
            FROM registros_ocr r
            LEFT JOIN sectores s ON s.id_sector = r.fk_sector
            LEFT JOIN usuarios u ON u.id_usuario = r.fk_usuario_creador
            WHERE r.id_registro=%s
            """,
            (registro_id,)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Registro {registro_id} no encontrado")

        cur.execute(
            """
            SELECT fila_index, n_nidos, n_cuevas_cubiertas, captura_hembras_tipo, total_pulpos
            FROM detalles_captura
            WHERE fk_registro=%s
            ORDER BY fila_index ASC
            """,
            (registro_id,)
        )
        detalles = cur.fetchall()
        return {
            "id_registro": row[0],
            "fecha_carga": row[1],
            "estado_validacion": row[2],
            "promedio_confianza": row[3],
            "url_imagen_original": row[4],
            "sector": row[5],
            "region": row[6],
            "usuario": row[7],
            "rechazo_motivo": row[8],
            "detalles": [
                {
                    "fila_index": d[0],
                    "n_nidos": d[1],
                    "n_cuevas": d[2],
                    "hembra": d[3],
                    "pulpos": d[4],
                }
                for d in detalles
            ],
        }
    finally:
        cur.close()
        conn.close()


@router.patch("/registros/{registro_id}/estado")
def validar_estado_registro(
    registro_id: int,
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    conn = get_connection()
    try:
        cur = conn.cursor()
        set_app_context(cur, current_user)
        timestamp = app_now_naive()
        cur.execute("SELECT COUNT(*) FROM detalles_captura WHERE fk_registro=%s", (registro_id,))
        if int(cur.fetchone()[0] or 0) == 0:
            raise HTTPException(status_code=422, detail="No hay detalles para validar. Edita y guarda la matriz primero.")

        cur.execute(
            """
            UPDATE registros_ocr
            SET estado_validacion='VALIDADO',
                rechazo_motivo=NULL,
                validated_at=%s,
                validated_by=%s,
                updated_at=%s
            WHERE id_registro=%s
            """,
            (timestamp, int(current_user["id"]), timestamp, registro_id)
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Registro {registro_id} no encontrado")
        conn.commit()
        return {"status": "ok", "id_registro": registro_id, "estado": "VALIDADO"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.patch("/registros/{registro_id}/rechazo")
def rechazar_registro(
    registro_id: int,
    payload: RechazoPayload,
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    logger.info("[SUPERVISION] Rechazando registro_id=%d  usuario=%s  motivo=%s",
                registro_id, current_user["username"], payload.motivo)
    motivo = payload.motivo.strip()
    if not motivo:
        raise HTTPException(status_code=422, detail="El motivo de rechazo es obligatorio")
    conn = get_connection()
    try:
        cur = conn.cursor()
        set_app_context(cur, current_user)
        timestamp = app_now_naive()
        cur.execute("ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS rechazo_motivo TEXT")
        cur.execute(
            """
            UPDATE registros_ocr
            SET estado_validacion='RECHAZADO', rechazo_motivo=%s, validated_at=%s, validated_by=%s, updated_at=%s
            WHERE id_registro=%s
            """,
            (motivo, timestamp, int(current_user["id"]), timestamp, registro_id)
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Registro {registro_id} no encontrado")
        conn.commit()
        return {"status": "ok", "id_registro": registro_id, "estado": "RECHAZADO"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.delete("/registros/{registro_id}")
def eliminar_registro(
    registro_id: int,
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    conn = get_connection()
    try:
        cur = conn.cursor()
        set_app_context(cur, current_user)
        timestamp = app_now_naive()
        cur.execute(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'chk_estado_validacion'
                      AND conrelid = 'registros_ocr'::regclass
                ) THEN
                    ALTER TABLE registros_ocr DROP CONSTRAINT chk_estado_validacion;
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'chk_estado_validacion'
                      AND conrelid = 'registros_ocr'::regclass
                ) THEN
                    ALTER TABLE registros_ocr ADD CONSTRAINT chk_estado_validacion CHECK (
                        estado_validacion IN (
                            'BORRADOR',
                            'PENDIENTE_VALIDACION',
                            'VALIDADO',
                            'APROBADO',
                            'RECHAZADO',
                            'ELIMINADO'
                        )
                    );
                END IF;
            END $$;
            """
        )
        cur.execute(
            """
            UPDATE registros_ocr
            SET estado_validacion='ELIMINADO',
                rechazo_motivo=COALESCE(rechazo_motivo, 'Eliminado desde panel de administración'),
                validated_at=%s,
                validated_by=%s,
                updated_at=%s
            WHERE id_registro=%s
              AND estado_validacion <> 'ELIMINADO'
            """,
            (timestamp, int(current_user["id"]), timestamp, registro_id)
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Registro {registro_id} no encontrado")
        conn.commit()
        return {"status": "ok", "id_registro": registro_id, "estado": "ELIMINADO"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()
