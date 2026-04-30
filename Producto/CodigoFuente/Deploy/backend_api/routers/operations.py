from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from services.motor_ia import procesar_registro_ocr
from services.db import get_connection
from dependencies.auth import require_roles

router = APIRouter(tags=["Operaciones OCR"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024

@router.post("/registros")
async def subir_registro(
    file: UploadFile = File(...),
    zona_id: int = Form(...),
    current_user: dict = Depends(require_roles(["admin", "supervisor", "buzo"]))
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Formato de imagen no permitido")

    contents = await file.read()
    
    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Imagen demasiado grande")

    try:
        resultado_ocr = procesar_registro_ocr(contents)

        if resultado_ocr.get("status") == "error":
            raise HTTPException(status_code=422, detail=resultado_ocr.get("mensaje", "Error OCR"))

        usuario_id = int(current_user["id"])

        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO registros_ocr 
            (fk_usuario_creador, fk_sector, url_imagen_original, promedio_confianza, estado_validacion, created_at, updated_at) 
            VALUES (%s,%s,%s,%s,%s, NOW(), NOW()) 
            RETURNING id_registro
            """,
            (
                usuario_id,
                zona_id,
                "url_pendiente",
                float(resultado_ocr.get("promedio_confianza", 0.0)),
                "PENDIENTE_VALIDACION"
            )
        )
        nuevo_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

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
        raise HTTPException(status_code=500, detail=str(e))
