from fastapi import APIRouter, Depends
from services.db import get_connection
from psycopg2.extras import RealDictCursor
from datetime import date, timedelta
from dependencies.auth import require_roles

router = APIRouter(tags=["Dashboard"])
DAYS = {0:"Lun",1:"Mar",2:"Mie",3:"Jue",4:"Vie",5:"Sab",6:"Dom"}
COORDS = {1:(-41.47,-72.94),2:(-41.80,-73.00),3:(-41.47,-72.93),4:(-45.50,-72.50)}

@router.get("/dashboard/data")
def get_dashboard_data(
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT COALESCE(SUM(total_pulpos),0) as t FROM detalles_captura")
        total_pulpos = cur.fetchone()["t"]
        cur.execute("SELECT COALESCE(SUM(n_cuevas_cubiertas),0) as oc, COALESCE(SUM(n_nidos),0) as tot FROM detalles_captura")
        r = cur.fetchone()
        ocupacion = (float(r["oc"])/float(r["tot"])*100) if r["tot"] > 0 else 0
        cur.execute("SELECT COUNT(*) as total, SUM(CASE WHEN estado_validacion='VALIDADO' THEN 1 ELSE 0 END) as ok FROM registros_ocr")
        r2 = cur.fetchone()
        eficiencia = (float(r2["ok"])/float(r2["total"])*100) if r2["total"] > 0 else 0
        cur.execute("SELECT DATE(fecha_carga) as dia, COUNT(*) as total FROM registros_ocr WHERE fecha_carga >= CURRENT_DATE - INTERVAL '6 days' GROUP BY dia ORDER BY dia")
        barras = cur.fetchall()
        cur.execute("SELECT s.id_sector, s.nombre_sector, s.region_chile, COUNT(DISTINCT r.id_registro) as tc, COALESCE(SUM(d.total_pulpos),0) as tp FROM sectores s LEFT JOIN registros_ocr r ON r.fk_sector=s.id_sector LEFT JOIN detalles_captura d ON d.fk_registro=r.id_registro GROUP BY s.id_sector,s.nombre_sector,s.region_chile")
        map_rows = cur.fetchall()
    finally:
        conn.close()
    today = date.today()
    days = [today - timedelta(days=i) for i in range(6,-1,-1)]
    bd = {row["dia"]: row["total"] for row in barras}
    bar = [{"name": DAYS[d.weekday()], "value": bd.get(d,0)} for d in days]
    mp = [{"id":r["id_sector"],"name":r["nombre_sector"],"region":r["region_chile"],
            "lat":COORDS.get(r["id_sector"],(-41.47,-72.94))[0],
            "lon":COORDS.get(r["id_sector"],(-41.47,-72.94))[1],
            "total_captura":int(r["tp"]),"total_cazas":int(r["tc"])} for r in map_rows]
    return {
        "kpis":[{"id":"kpi1","label":"Total Pulpos","value":int(total_pulpos),"unit":"und"},
                {"id":"kpi2","label":"% Ocupacion","value":round(ocupacion,1),"unit":"%"},
                {"id":"kpi3","label":"Tasa Reprod.","value":0,"unit":"%"},
                {"id":"kpi4","label":"Eficiencia","value":round(eficiencia,1),"unit":"%"}],
        "barData":bar,"lineData":bar,"mapData":mp
    }
