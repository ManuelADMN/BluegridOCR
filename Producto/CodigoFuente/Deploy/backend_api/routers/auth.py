from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from psycopg2.extras import RealDictCursor

from services.db import get_connection
from services.security import verify_password
from services.jwt_service import create_access_token
from services.timezone import app_now_naive
from services.rate_limiter import login_rate_limiter
from dependencies.auth import normalize_role
from core.logger import logger

router = APIRouter(tags=["Auth"])

class LoginPayload(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)


def _client_key(request: Request, username: str) -> str:
    """Clave de rate limiting por (IP, usuario). Respeta el primer salto de X-Forwarded-For
    cuando el backend está tras un proxy."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        ip = fwd.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"
    return f"{ip}|{username.strip().lower()}"


@router.post("/auth/login")
def login(payload: LoginPayload, request: Request):
    conn = None
    key = _client_key(request, payload.username)

    # Bloqueo por fuerza bruta: se evalúa antes de tocar la BD.
    wait = login_rate_limiter.seconds_until_unlock(key)
    if wait:
        logger.warning("login_rate_limited key=%s retry_after=%s", key, wait)
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos fallidos. Vuelve a intentarlo más tarde.",
            headers={"Retry-After": str(wait)},
        )

    def _register_and_raise(detail: str):
        locked = login_rate_limiter.register_failure(key)
        if locked:
            logger.warning("login_locked key=%s lock_seconds=%s", key, locked)
            raise HTTPException(
                status_code=429,
                detail="Demasiados intentos fallidos. Vuelve a intentarlo más tarde.",
                headers={"Retry-After": str(locked)},
            )
        raise HTTPException(status_code=401, detail=detail)

    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            """
            SELECT
                u.id_usuario,
                u.correo AS username,
                u.nombre_completo,
                u.password_hash,
                r.nombre_rol AS rol
            FROM usuarios u
            JOIN roles r ON r.id_rol = u.fk_rol
            WHERE LOWER(u.correo) = LOWER(%s)
            AND COALESCE(u.activo, TRUE) = TRUE
            LIMIT 1
            """,
            (payload.username,)
        )

        row = cur.fetchone()

        if not row:
            logger.warning("login_failed username=%s reason=user_not_found", payload.username)
            _register_and_raise("Credenciales inválidas")

        if not row.get("password_hash"):
            logger.warning("login_failed username=%s reason=no_password_hash", payload.username)
            _register_and_raise("Usuario sin contraseña segura configurada")

        if not verify_password(payload.password, row["password_hash"]):
            logger.warning("login_failed username=%s reason=wrong_password", payload.username)
            _register_and_raise("Credenciales inválidas")

        # Login válido: limpia el contador de intentos de esta clave.
        login_rate_limiter.reset(key)

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
            SET last_login_at = %s
            WHERE id_usuario = %s
            """,
            (app_now_naive(), row["id_usuario"],)
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
        if conn:
            conn.rollback()
        raise

    except Exception:
        if conn:
            conn.rollback()
        logger.exception("login_error username=%s", payload.username)
        raise HTTPException(status_code=503, detail="Base de datos no disponible")

    finally:
        if conn:
            conn.close()
