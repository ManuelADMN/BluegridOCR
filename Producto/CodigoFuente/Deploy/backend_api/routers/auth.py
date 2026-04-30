from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from psycopg2.extras import RealDictCursor

from services.db import get_connection
from services.security import verify_password
from services.jwt_service import create_access_token
from dependencies.auth import normalize_role
from core.logger import logger

router = APIRouter(tags=["Auth"])

class LoginPayload(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)

@router.post("/auth/login")
def login(payload: LoginPayload):
    conn = get_connection()

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            """
            SELECT
                u.id_usuario,
                u.username,
                u.nombre_completo,
                u.password_hash,
                r.nombre_rol AS rol
            FROM usuarios u
            JOIN roles r ON r.id_rol = u.fk_rol
            WHERE u.username = %s
            AND COALESCE(u.activo, TRUE) = TRUE
            LIMIT 1
            """,
            (payload.username,)
        )

        row = cur.fetchone()

        if not row:
            logger.warning("login_failed username=%s reason=user_not_found", payload.username)
            raise HTTPException(status_code=401, detail="Credenciales inválidas")

        if not row.get("password_hash"):
            logger.warning("login_failed username=%s reason=no_password_hash", payload.username)
            raise HTTPException(status_code=401, detail="Usuario sin contraseña segura configurada")

        if not verify_password(payload.password, row["password_hash"]):
            logger.warning("login_failed username=%s reason=wrong_password", payload.username)
            raise HTTPException(status_code=401, detail="Credenciales inválidas")

        role = normalize_role(row["rol"])

        access_token = create_access_token({
            "sub": str(row["id_usuario"]),
            "username": row["username"],
            "name": row["nombre_completo"],
            "role": role,
        })

        cur.execute(
            """
            UPDATE usuarios
            SET last_login_at = NOW()
            WHERE id_usuario = %s
            """,
            (row["id_usuario"],)
        )
        conn.commit()

        logger.info("login_success username=%s role=%s", row["username"], role)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "id": row["id_usuario"],
            "username": row["username"],
            "name": row["nombre_completo"],
            "role": role,
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        conn.close()
