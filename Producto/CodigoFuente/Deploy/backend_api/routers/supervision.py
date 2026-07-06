from fastapi import APIRouter, HTTPException, Depends
from services.db import get_connection
from pydantic import BaseModel, Field
from typing import List, Optional

MAX_MOTIVO_RECHAZO = 200
from dependencies.auth import require_roles
from services.timezone import app_now_naive
from services.audit import insert_audit_event
from services import storage
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
    motivo: str = Field(..., min_length=1, max_length=MAX_MOTIVO_RECHAZO)


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


def _save_detalles(cur, registro_id: int, detalles: list[DetalleRow], user_id: int, timestamp) -> None:
    for detalle in detalles:
        cur.execute(
            """
            UPDATE detalles_captura
            SET n_nidos = %s,
                n_cuevas_cubiertas = %s,
                captura_hembras_tipo = %s,
                total_pulpos = %s,
                updated_at = %s,
                editado_por = %s
            WHERE fk_registro = %s AND fila_index = %s
            """,
            (
                detalle.n_nidos, detalle.n_cuevas, detalle.hembra, detalle.pulpos,
                timestamp, user_id, registro_id, detalle.fila_index,
            ),
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
                    registro_id, detalle.fila_index, detalle.n_nidos, detalle.n_cuevas,
                    detalle.hembra, detalle.pulpos, timestamp, user_id,
                ),
            )


@router.put("/registros/{registro_id}/confirmacion")
def confirmar_registro_buzo(
    registro_id: int,
    payload: ValidacionPayload,
    current_user: dict = Depends(require_roles(["buzo"])),
):
    """Guarda la revisión del buzo sin otorgarle validación administrativa."""
    conn = get_connection()
    cur = None
    try:
        cur = conn.cursor()
        set_app_context(cur, current_user)
        detalles = _normalize_detalles(payload.detalles)
        if not detalles:
            raise HTTPException(status_code=422, detail="No hay detalles para confirmar")

        cur.execute(
            """
            SELECT fk_usuario_creador, estado_validacion
            FROM registros_ocr
            WHERE id_registro = %s
            FOR UPDATE
            """,
            (registro_id,),
        )
        registro = cur.fetchone()
        if not registro:
            raise HTTPException(status_code=404, detail=f"Registro {registro_id} no encontrado")
        if int(registro[0]) != int(current_user["id"]):
            raise HTTPException(status_code=403, detail="Solo puedes confirmar tus propias digitalizaciones")

        estado = str(registro[1] or "").upper()
        if estado in {"VALIDADO", "APROBADO", "ELIMINADO"}:
            raise HTTPException(status_code=409, detail=f"El registro no puede confirmarse en estado {estado}")

        timestamp = app_now_naive()
        _save_detalles(cur, registro_id, detalles, int(current_user["id"]), timestamp)
        cur.execute(
            """
            UPDATE registros_ocr
            SET estado_validacion = 'PENDIENTE_VALIDACION',
                rechazo_motivo = NULL,
                updated_at = %s
            WHERE id_registro = %s
            """,
            (timestamp, registro_id),
        )
        insert_audit_event(
            cur,
            current_user,
            action="ocr_submitted_by_diver",
            entity="registros_ocr",
            entity_id=registro_id,
            detail={"detail_rows": len(detalles)},
        )
        conn.commit()
        logger.info(
            "[SUPERVISION] Buzo %s confirmó registro=%d con %d filas; queda pendiente",
            current_user["username"], registro_id, len(detalles),
        )
        return {
            "status": "ok",
            "id_registro": registro_id,
            "estado": "PENDIENTE_VALIDACION",
            "detalles": len(detalles),
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        conn.rollback()
        logger.exception("[SUPERVISION] Error al confirmar registro de buzo id=%d", registro_id)
        raise HTTPException(status_code=500, detail="No se pudo confirmar la digitalización") from exc
    finally:
        if cur:
            cur.close()
        conn.close()

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
        _save_detalles(cur, registro_id, detalles, int(current_user["id"]), timestamp)

        insert_audit_event(
            cur,
            current_user,
            action="ocr_validated",
            entity="registros_ocr",
            entity_id=registro_id,
            detail={"detail_rows": len(detalles)},
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
        insert_audit_event(
            cur,
            current_user,
            action="ocr_validated",
            entity="registros_ocr",
            entity_id=registro_id,
            detail={"source": "state_transition"},
        )
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
        insert_audit_event(
            cur,
            current_user,
            action="ocr_rejected",
            entity="registros_ocr",
            entity_id=registro_id,
            detail={"reason": motivo},
        )
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
        insert_audit_event(
            cur,
            current_user,
            action="ocr_soft_deleted",
            entity="registros_ocr",
            entity_id=registro_id,
            detail={"state": "ELIMINADO"},
        )
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


@router.delete("/registros/{registro_id}/purga")
def purgar_registro(
    registro_id: int,
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Supresión real de los datos personales de un registro (Ley 21.719, arts. 4 y 7).

    A diferencia de DELETE /registros/{id} (que sólo marca ELIMINADO y conserva todo), esta
    operación elimina de forma irreversible los artefactos personales/biométricos:
      - los archivos de imagen en disco (original, rectificada, previews);
      - los recortes de escritura (recorte_base64) en feedback_ia asociados al registro;
      - las URLs de imagen en registros_ocr.

    Se conserva una fila-lápida en estado ELIMINADO para no romper integridad referencial ni
    la trazabilidad de auditoría (art. 3 e, principio de responsabilidad). La operación es
    idempotente: repetirla no falla.
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        set_app_context(cur, current_user)
        timestamp = app_now_naive()

        cur.execute(
            "SELECT 1 FROM registros_ocr WHERE id_registro=%s",
            (registro_id,),
        )
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail=f"Registro {registro_id} no encontrado")

        # 1) Recortes de escritura (dato más sensible) → se anulan en la BD.
        cur.execute(
            "UPDATE feedback_ia SET recorte_base64=NULL WHERE fk_registro=%s AND recorte_base64 IS NOT NULL",
            (registro_id,),
        )
        recortes_purgados = cur.rowcount

        # 2) URLs de imagen + estado en registros_ocr.
        # url_imagen_original es NOT NULL: se vacía con '' (no NULL) para no violar la constraint;
        # el artefacto real ya se borra del disco en el paso 3. url_imagen_procesada sí admite NULL.
        cur.execute(
            """
            UPDATE registros_ocr
            SET estado_validacion='ELIMINADO',
                url_imagen_original='',
                url_imagen_procesada=NULL,
                rechazo_motivo=COALESCE(rechazo_motivo, 'Datos suprimidos (derecho de supresión)'),
                validated_at=%s,
                validated_by=%s,
                updated_at=%s
            WHERE id_registro=%s
            """,
            (timestamp, int(current_user["id"]), timestamp, registro_id),
        )

        # 3) Archivos en disco → se borran de forma irreversible. Si falla, revertimos la BD.
        archivos_eliminados = storage.eliminar_directorio(registro_id)

        insert_audit_event(
            cur,
            current_user,
            action="ocr_purged",
            entity="registros_ocr",
            entity_id=registro_id,
            detail={
                "snippets_removed": recortes_purgados,
                "files_removed": archivos_eliminados,
            },
        )
        conn.commit()
        logger.info(
            "[SUPERVISION] purga registro=%s por usuario=%s recortes=%d archivos=%d",
            registro_id, current_user["id"], recortes_purgados, archivos_eliminados,
        )
        return {
            "status": "ok",
            "id_registro": registro_id,
            "estado": "ELIMINADO",
            "recortes_purgados": recortes_purgados,
            "archivos_eliminados": archivos_eliminados,
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()
