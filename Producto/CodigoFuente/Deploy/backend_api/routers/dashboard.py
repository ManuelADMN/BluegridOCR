from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from psycopg2.extras import RealDictCursor

from dependencies.auth import require_roles
from services.db import get_connection

router = APIRouter(tags=["Dashboard"])

DAYS = {0: "Lun", 1: "Mar", 2: "Mie", 3: "Jue", 4: "Vie", 5: "Sab", 6: "Dom"}
MONTHS = {
    1: "ene",
    2: "feb",
    3: "mar",
    4: "abr",
    5: "may",
    6: "jun",
    7: "jul",
    8: "ago",
    9: "sep",
    10: "oct",
    11: "nov",
    12: "dic",
}
COORDS = {
    1: (-36.72, -73.05),
    2: (-37.18, -73.32),
    3: (-36.62, -73.09),
    4: (-36.54, -72.95),
    5: (-37.14, -73.58),
    8: (-41.83, -73.52),
    16: (-45.40, -72.70),
    17: (-44.74, -72.70),
    18: (-53.16, -70.91),
    19: (-54.87, -68.30),
}


def safe_pct(numerator: float, denominator: float) -> float:
    return round((float(numerator) / float(denominator) * 100), 1) if denominator else 0.0


def trend_pct(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round(((float(current) - float(previous)) / float(previous)) * 100, 1)


def period_label(start: date, end: date) -> str:
    if start.year == end.year:
        if start.month == end.month:
            return f"{start.day} - {end.day} {MONTHS[end.month]} {end.year}"
        return f"{start.day} {MONTHS[start.month]} - {end.day} {MONTHS[end.month]} {end.year}"
    return f"{start.day} {MONTHS[start.month]} {start.year} - {end.day} {MONTHS[end.month]} {end.year}"


def empty_day(day: date) -> dict:
    return {
        "date": day,
        "pulpos": 0,
        "nidos": 0,
        "cuevas": 0,
        "hembras": 0,
        "registros": 0,
        "validados": 0,
    }


def metric_value(row: dict, metric_id: str) -> float:
    if metric_id == "total_pulpos":
        return int(row["pulpos"])
    if metric_id == "ocupacion":
        return int(row["nidos"])
    if metric_id == "tasa_reproductiva":
        return safe_pct(row["hembras"], row["nidos"])
    if metric_id == "registros_validados":
        return int(row["validados"])
    if metric_id == "eficiencia_validacion":
        return int(row["hembras"])
    return 0.0


@router.get("/dashboard/data")
def get_dashboard_data(
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    conn = get_connection()

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)

        if fecha_desde and fecha_hasta and fecha_desde > fecha_hasta:
            fecha_desde, fecha_hasta = fecha_hasta, fecha_desde

        if fecha_hasta:
            latest_day = fecha_hasta
        else:
            cur.execute(
                """
                SELECT COALESCE(MAX(DATE(fecha_carga)), CURRENT_DATE) AS latest_day
                FROM registros_ocr
                WHERE UPPER(COALESCE(estado_validacion, '')) <> 'ELIMINADO'
                """
            )
            latest_day = cur.fetchone()["latest_day"]

        current_end = latest_day
        current_start = fecha_desde or (current_end - timedelta(days=6))
        period_days = max((current_end - current_start).days + 1, 1)
        previous_end = current_start - timedelta(days=1)
        previous_start = previous_end - timedelta(days=period_days - 1)

        cur.execute(
            """
            SELECT
                DATE(r.fecha_carga) AS dia,
                COALESCE(SUM(d.total_pulpos), 0) AS pulpos,
                COALESCE(SUM(d.n_nidos), 0) AS nidos,
                COALESCE(SUM(d.n_cuevas_cubiertas), 0) AS cuevas,
                COALESCE(SUM(CASE WHEN d.captura_hembras_tipo > 0 THEN 1 ELSE 0 END), 0) AS hembras,
                COUNT(DISTINCT r.id_registro) AS registros,
                COUNT(DISTINCT CASE WHEN r.estado_validacion = 'VALIDADO' THEN r.id_registro END) AS validados
            FROM registros_ocr r
            LEFT JOIN detalles_captura d
                ON d.fk_registro = r.id_registro
               AND r.estado_validacion = 'VALIDADO'
            WHERE DATE(r.fecha_carga) BETWEEN %s AND %s
              AND UPPER(COALESCE(r.estado_validacion, '')) <> 'ELIMINADO'
            GROUP BY DATE(r.fecha_carga)
            ORDER BY dia
            """,
            (previous_start, current_end),
        )
        rows_by_day = {row["dia"]: row for row in cur.fetchall()}

        cur.execute(
            """
            SELECT
                s.id_sector,
                s.nombre_sector,
                s.region_chile,
                COUNT(DISTINCT r.id_registro) AS registros,
                COALESCE(SUM(d.total_pulpos), 0) AS pulpos
            FROM sectores s
            LEFT JOIN registros_ocr r
                ON r.fk_sector = s.id_sector
               AND DATE(r.fecha_carga) BETWEEN %s AND %s
               AND r.estado_validacion = 'VALIDADO'
            LEFT JOIN detalles_captura d
                ON d.fk_registro = r.id_registro
               AND r.estado_validacion = 'VALIDADO'
            GROUP BY s.id_sector, s.nombre_sector, s.region_chile
            ORDER BY pulpos DESC, registros DESC, s.nombre_sector ASC
            """,
            (current_start, current_end),
        )
        sector_rows = cur.fetchall()

        cur.execute(
            """
            SELECT
                r.id_registro,
                r.fecha_carga,
                r.estado_validacion,
                r.url_imagen_original,
                COALESCE(r.promedio_confianza, 0) AS promedio_confianza,
                COALESCE(s.nombre_sector, 'Sin sector') AS sector,
                COALESCE(s.region_chile, 'Sin region') AS region,
                COALESCE(u.nombre_completo, u.correo, 'Sin usuario') AS buzo,
                COALESCE(SUM(d.total_pulpos), 0) AS total_pulpos,
                COALESCE(SUM(d.n_nidos), 0) AS nidos,
                COALESCE(SUM(d.n_cuevas_cubiertas), 0) AS cuevas
            FROM registros_ocr r
            LEFT JOIN sectores s ON s.id_sector = r.fk_sector
            LEFT JOIN usuarios u ON u.id_usuario = r.fk_usuario_creador
            LEFT JOIN detalles_captura d
                ON d.fk_registro = r.id_registro
               AND r.estado_validacion = 'VALIDADO'
            WHERE DATE(r.fecha_carga) BETWEEN %s AND %s
              AND UPPER(COALESCE(r.estado_validacion, '')) <> 'ELIMINADO'
            GROUP BY r.id_registro, r.fecha_carga, r.estado_validacion, r.url_imagen_original, r.promedio_confianza,
                     s.nombre_sector, s.region_chile, u.nombre_completo, u.correo
            ORDER BY r.fecha_carga DESC, r.id_registro DESC
            LIMIT 8
            """,
            (current_start, current_end),
        )
        recent_records = cur.fetchall()

        cur.execute(
            """
            SELECT
                COUNT(*) AS total_sectores
            FROM sectores
            """
        )
        total_sectores = int(cur.fetchone()["total_sectores"] or 0)

        cur.execute(
            """
            SELECT
                COUNT(DISTINCT u.id_usuario) AS total_buzos
            FROM usuarios u
            JOIN roles ro ON ro.id_rol = u.fk_rol
            WHERE LOWER(ro.nombre_rol) = 'buzo'
            """
        )
        total_buzos = int(cur.fetchone()["total_buzos"] or 0)

        cur.execute(
            """
            SELECT
                COALESCE(AVG(promedio_confianza), 0) AS promedio_confianza
            FROM registros_ocr
            WHERE DATE(fecha_carga) BETWEEN %s AND %s
              AND UPPER(COALESCE(estado_validacion, '')) <> 'ELIMINADO'
            """,
            (current_start, current_end),
        )
        avg_confidence = float(cur.fetchone()["promedio_confianza"] or 0)

        cur.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE estado_validacion = 'PENDIENTE_VALIDACION') AS pendientes,
                COUNT(*) FILTER (WHERE estado_validacion = 'RECHAZADO') AS rechazados
            FROM registros_ocr
            WHERE DATE(fecha_carga) BETWEEN %s AND %s
              AND UPPER(COALESCE(estado_validacion, '')) <> 'ELIMINADO'
            """,
            (current_start, current_end),
        )
        status_counts = cur.fetchone()

    finally:
        conn.close()

    current_days = [current_start + timedelta(days=i) for i in range(period_days)]
    previous_days = [previous_start + timedelta(days=i) for i in range(period_days)]

    current_rows = [dict(rows_by_day.get(day) or empty_day(day)) for day in current_days]
    previous_rows = [dict(rows_by_day.get(day) or empty_day(day)) for day in previous_days]

    current_totals = {
        "pulpos": sum(int(row["pulpos"]) for row in current_rows),
        "nidos": sum(int(row["nidos"]) for row in current_rows),
        "cuevas": sum(int(row["cuevas"]) for row in current_rows),
        "hembras": sum(int(row["hembras"]) for row in current_rows),
        "registros": sum(int(row["registros"]) for row in current_rows),
        "validados": sum(int(row["validados"]) for row in current_rows),
    }
    current_pending = int(status_counts["pendientes"] or 0)
    current_rejected = int(status_counts["rechazados"] or 0)
    previous_totals = {
        "pulpos": sum(int(row["pulpos"]) for row in previous_rows),
        "nidos": sum(int(row["nidos"]) for row in previous_rows),
        "cuevas": sum(int(row["cuevas"]) for row in previous_rows),
        "hembras": sum(int(row["hembras"]) for row in previous_rows),
        "registros": sum(int(row["registros"]) for row in previous_rows),
        "validados": sum(int(row["validados"]) for row in previous_rows),
    }

    kpi_specs = [
        {
            "id": "total_pulpos",
            "label": "Total Pulpos",
            "unit": "und",
            "description": "Pulpos registrados en detalles de captura",
            "value": current_totals["pulpos"],
            "current": current_totals["pulpos"],
            "previous": previous_totals["pulpos"],
        },
        {
            "id": "ocupacion",
            "label": "Nidos encontrados",
            "unit": "und",
            "description": "Nidos con huevos registrados",
            "value": current_totals["nidos"],
            "current": current_totals["nidos"],
            "previous": previous_totals["nidos"],
        },
        {
            "id": "registros_validados",
            "label": "Registros Validados",
            "unit": "und",
            "description": "Registros revisados y aprobados",
            "value": current_totals["validados"],
            "current": current_totals["validados"],
            "previous": previous_totals["validados"],
        },
        {
            "id": "tasa_reproductiva",
            "label": "Tasa Reprod.",
            "unit": "%",
            "description": "Filas con hembras sobre nidos registrados",
            "value": safe_pct(current_totals["hembras"], current_totals["nidos"]),
            "current": safe_pct(current_totals["hembras"], current_totals["nidos"]),
            "previous": safe_pct(previous_totals["hembras"], previous_totals["nidos"]),
        },
    ]

    kpis = []
    for spec in kpi_specs:
        kpis.append({
            "id": spec["id"],
            "label": spec["label"],
            "value": spec["value"],
            "unit": spec["unit"],
            "description": spec["description"],
            "current_period_value": spec["current"],
            "previous_period_value": spec["previous"],
            "trend_pct": trend_pct(spec["current"], spec["previous"]),
            "series": [
                {
                    "name": DAYS[current_days[i].weekday()],
                    "current": metric_value(current_rows[i], spec["id"]),
                    "previous": metric_value(previous_rows[i], spec["id"]),
                    "current_date": current_days[i].isoformat(),
                    "previous_date": previous_days[i].isoformat(),
                }
                for i in range(period_days)
            ],
        })

    eficiencia = safe_pct(current_totals["validados"], current_totals["registros"])
    kpis.append({
        "id": "eficiencia_validacion",
        "label": "Huevos encontrados",
        "value": current_totals["hembras"],
        "unit": "und",
        "description": "Filas con huevos/hembras registradas",
        "current_period_value": current_totals["hembras"],
        "previous_period_value": previous_totals["hembras"],
        "trend_pct": trend_pct(current_totals["hembras"], previous_totals["hembras"]),
        "series": [],
    })

    bar_data = [
        {
            "name": DAYS[day.weekday()],
            "value": int(current_rows[i]["pulpos"]),
            "date": day.isoformat(),
            "registros": int(current_rows[i]["registros"]),
        }
        for i, day in enumerate(current_days)
    ]

    map_data = [
        {
            "id": row["id_sector"],
            "name": row["nombre_sector"],
            "region": row["region_chile"],
            "lat": COORDS.get(row["id_sector"], (-41.47, -72.94))[0],
            "lon": COORDS.get(row["id_sector"], (-41.47, -72.94))[1],
            "total_captura": int(row["pulpos"]),
            "total_cazas": int(row["registros"]),
        }
        for row in sector_rows
    ]

    return {
        "context": {
            "latest_day": latest_day.isoformat(),
            "current_period": {
                "start": current_start.isoformat(),
                "end": current_end.isoformat(),
                "label": period_label(current_start, current_end),
            },
            "previous_period": {
                "start": previous_start.isoformat(),
                "end": previous_end.isoformat(),
                "label": period_label(previous_start, previous_end),
            },
        },
        "summary": {
            "nidos": current_totals["nidos"],
            "cuevas_cubiertas": current_totals["cuevas"],
            "hembras_con_huevos": current_totals["hembras"],
            "registros": current_totals["registros"],
            "registros_validados": current_totals["validados"],
            "registros_pendientes": current_pending,
            "registros_rechazados": current_rejected,
            "sectores": total_sectores,
            "buzos": total_buzos,
            "promedio_confianza_ocr": round(avg_confidence, 4),
            "ocupacion_pct": safe_pct(current_totals["cuevas"], current_totals["nidos"]),
            "tasa_reproductiva_pct": safe_pct(current_totals["hembras"], current_totals["nidos"]),
            "eficiencia_validacion_pct": eficiencia,
        },
        "kpis": kpis,
        "barData": bar_data,
        "lineData": bar_data,
        "mapData": map_data,
        "recentRecords": recent_records,
        "pendingRecords": [
            row for row in recent_records
            if str(row["estado_validacion"] or "").upper() == "PENDIENTE_VALIDACION"
        ],
    }
