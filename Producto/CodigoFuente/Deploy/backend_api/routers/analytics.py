from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from psycopg2.extras import RealDictCursor

from services.db import get_connection
from dependencies.auth import require_roles

router = APIRouter(tags=["Analytics"])

@router.get("/analytics/buzos")
def get_buzo_analytics(
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    buzo_id: Optional[int] = Query(None),
    estado_validacion: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    conn = get_connection()

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)

        filters = ["UPPER(COALESCE(r.estado_validacion, '')) <> 'ELIMINADO'"]
        params = []

        if fecha_desde:
            filters.append("DATE(r.fecha_carga) >= %s")
            params.append(fecha_desde)

        if fecha_hasta:
            filters.append("DATE(r.fecha_carga) <= %s")
            params.append(fecha_hasta)

        if buzo_id:
            filters.append("u.id_usuario = %s")
            params.append(buzo_id)

        if estado_validacion and estado_validacion.upper() != "ELIMINADO":
            filters.append("LOWER(r.estado_validacion) = LOWER(%s)")
            params.append(estado_validacion)
        elif estado_validacion and estado_validacion.upper() == "ELIMINADO":
            filters = ["UPPER(COALESCE(r.estado_validacion, '')) = 'ELIMINADO'"]

        where_sql = "WHERE " + " AND ".join(filters)

        query_por_buzo = f"""
            SELECT
                u.id_usuario AS id_buzo,
                u.nombre_completo AS nombre_buzo,
                u.correo AS username,
                COUNT(r.*) AS total_plantillas,
                SUM(CASE WHEN LOWER(COALESCE(r.estado_validacion, '')) = 'validado' THEN 1 ELSE 0 END) AS plantillas_validadas,
                SUM(CASE WHEN LOWER(COALESCE(r.estado_validacion, 'pendiente_validacion')) <> 'validado' THEN 1 ELSE 0 END) AS plantillas_pendientes,
                MAX(r.fecha_carga) AS ultima_digitalizacion
            FROM registros_ocr r
            JOIN usuarios u ON u.id_usuario = r.fk_usuario_creador
            {where_sql}
            GROUP BY u.id_usuario, u.nombre_completo, u.correo
            ORDER BY total_plantillas DESC
        """

        cur.execute(query_por_buzo, params)
        por_buzo = cur.fetchall()

        query_resumen = f"""
            SELECT
                COUNT(r.*) AS total_plantillas,
                COUNT(DISTINCT u.id_usuario) AS total_buzos,
                SUM(CASE WHEN LOWER(COALESCE(r.estado_validacion, '')) = 'validado' THEN 1 ELSE 0 END) AS plantillas_validadas,
                SUM(CASE WHEN LOWER(COALESCE(r.estado_validacion, 'pendiente_validacion')) <> 'validado' THEN 1 ELSE 0 END) AS plantillas_pendientes
            FROM registros_ocr r
            JOIN usuarios u ON u.id_usuario = r.fk_usuario_creador
            {where_sql}
        """

        cur.execute(query_resumen, params)
        resumen = cur.fetchone() or {}

        total_plantillas = resumen.get("total_plantillas") or 0
        total_buzos = resumen.get("total_buzos") or 0

        resumen["promedio_plantillas_por_buzo"] = (
            float(total_plantillas) / float(total_buzos)
            if total_buzos else 0
        )

        query_serie = f"""
            SELECT
                DATE(r.fecha_carga) AS fecha,
                u.id_usuario AS id_buzo,
                u.nombre_completo AS nombre_buzo,
                COUNT(r.*) AS total_plantillas
            FROM registros_ocr r
            JOIN usuarios u ON u.id_usuario = r.fk_usuario_creador
            {where_sql}
            GROUP BY DATE(r.fecha_carga), u.id_usuario, u.nombre_completo
            ORDER BY fecha ASC
        """

        cur.execute(query_serie, params)
        serie_temporal = cur.fetchall()

        return {
            "resumen": resumen,
            "por_buzo": por_buzo,
            "serie_temporal": serie_temporal
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno en análisis por buzo")

    finally:
        conn.close()
