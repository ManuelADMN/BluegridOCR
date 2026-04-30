from fastapi import APIRouter, Depends
from services.db import get_connection
from psycopg2.extras import RealDictCursor
from dependencies.auth import require_roles

router = APIRouter(tags=["Contexto"])

@router.get("/context/zonas")
def get_zonas(
    current_user: dict = Depends(require_roles(["admin", "supervisor", "buzo"]))
):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id_sector AS id, nombre_sector AS name FROM sectores")
        return cur.fetchall()
    finally:
        conn.close()

@router.get("/context/embarcaciones")
def get_embarcaciones(
    current_user: dict = Depends(require_roles(["admin", "supervisor", "buzo"]))
):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id_embarcacion AS id, nombre_embarcacion AS name, matricula FROM embarcaciones")
        return cur.fetchall()
    finally:
        conn.close()
