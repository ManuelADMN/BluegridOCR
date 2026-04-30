from fastapi import APIRouter, HTTPException, Depends
from services.db import get_connection
from pydantic import BaseModel
from typing import List, Optional
from dependencies.auth import require_roles

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

@router.put("/registros/{registro_id}/validacion")
def validar_registro(
    registro_id: int, 
    payload: ValidacionPayload,
    current_user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    conn = get_connection()
    try:
        cur = conn.cursor()

        # 1. Marcar el registro como VALIDADO
        cur.execute(
            "UPDATE registros_ocr SET estado_validacion='VALIDADO' WHERE id_registro=%s",
            (registro_id,)
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Registro {registro_id} no encontrado")

        # 2. Eliminar detalles previos si los hubiera
        cur.execute("DELETE FROM detalles_captura WHERE fk_registro=%s", (registro_id,))

        # 3. Insertar nuevos detalles fila por fila
        for d in payload.detalles:
            cur.execute(
                """
                INSERT INTO detalles_captura
                    (fk_registro, fila_index, n_nidos, n_cuevas_cubiertas,
                     captura_hembras_tipo, total_pulpos)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (registro_id, d.fila_index, d.n_nidos, d.n_cuevas, d.hembra, d.pulpos)
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
