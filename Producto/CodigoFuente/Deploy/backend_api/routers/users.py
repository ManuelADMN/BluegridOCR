from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Literal
from psycopg2.extras import RealDictCursor

from services.db import get_connection
from services.security import hash_password
from dependencies.auth import require_roles
from core.logger import logger

router = APIRouter(tags=["Users"])

AllowedRole = Literal["admin", "supervisor", "buzo"]

class CreateUserPayload(BaseModel):
    username: str = Field(..., min_length=3)
    nombre_completo: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    rol: AllowedRole

@router.post("/users")
def create_user(
    payload: CreateUserPayload,
    current_user: dict = Depends(require_roles(["admin"]))
):
    conn = get_connection()

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            """
            SELECT id_usuario
            FROM usuarios
            WHERE username = %s
            LIMIT 1
            """,
            (payload.username,)
        )

        if cur.fetchone():
            raise HTTPException(status_code=409, detail="El username ya existe")

        cur.execute(
            """
            SELECT id_rol
            FROM roles
            WHERE LOWER(nombre_rol) = LOWER(%s)
            LIMIT 1
            """,
            (payload.rol,)
        )

        role_row = cur.fetchone()

        if not role_row:
            raise HTTPException(status_code=400, detail=f"Rol no encontrado: {payload.rol}")

        password_hash = hash_password(payload.password)

        cur.execute(
            """
            INSERT INTO usuarios (
                username,
                nombre_completo,
                password_hash,
                fk_rol,
                activo,
                created_at,
                updated_at
            )
            VALUES (%s, %s, %s, %s, TRUE, NOW(), NOW())
            RETURNING id_usuario
            """,
            (
                payload.username,
                payload.nombre_completo,
                password_hash,
                role_row["id_rol"],
            )
        )

        new_user = cur.fetchone()

        cur.execute(
            """
            INSERT INTO auditoria_eventos (
                fk_usuario,
                username,
                rol,
                accion,
                entidad,
                entidad_id,
                detalle
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
            """,
            (
                int(current_user["id"]),
                current_user["username"],
                current_user["role"],
                "user_created",
                "usuarios",
                str(new_user["id_usuario"]),
                '{"source":"admin_panel"}',
            )
        )

        conn.commit()

        logger.info(
            "user_created username=%s role=%s created_by=%s",
            payload.username,
            payload.rol,
            current_user["username"]
        )

        return {
            "status": "ok",
            "id_usuario": new_user["id_usuario"],
            "username": payload.username,
            "nombre_completo": payload.nombre_completo,
            "rol": payload.rol,
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        logger.exception("user_create_error")
        raise HTTPException(status_code=500, detail="Error interno al crear usuario")

    finally:
        conn.close()

@router.get("/users")
def list_users(
    current_user: dict = Depends(require_roles(["admin"]))
):
    conn = get_connection()

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            """
            SELECT
                u.id_usuario,
                u.username,
                u.nombre_completo,
                u.activo,
                u.created_at,
                u.last_login_at,
                r.nombre_rol AS rol
            FROM usuarios u
            JOIN roles r ON r.id_rol = u.fk_rol
            ORDER BY u.created_at DESC
            """
        )

        return {
            "items": cur.fetchall()
        }

    finally:
        conn.close()
