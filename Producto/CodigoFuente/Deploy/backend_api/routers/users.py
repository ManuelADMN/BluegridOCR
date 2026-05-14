from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
import hashlib
from typing import Literal, Optional
from psycopg2.extras import RealDictCursor

from services.db import get_connection
from services.security import hash_password
from services.timezone import app_now_naive
from dependencies.auth import require_roles
from core.logger import logger

router = APIRouter(tags=["Users"])

AllowedRole = Literal["admin", "supervisor", "buzo"]

class CreateUserPayload(BaseModel):
    username: Optional[str] = Field(None, min_length=3)
    correo: Optional[str] = Field(None, min_length=3)
    rut: Optional[str] = None
    nombre_completo: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    rol: Optional[AllowedRole] = None
    fk_rol: Optional[int] = None
    fk_embarcacion: Optional[int] = None
    id_tablilla: Optional[str] = None

class UpdateUserPayload(BaseModel):
    username: Optional[str] = Field(None, min_length=3)
    correo: Optional[str] = Field(None, min_length=3)
    nombre_completo: Optional[str] = Field(None, min_length=3)
    password: Optional[str] = Field(None, min_length=6)
    rol: Optional[AllowedRole] = None
    fk_rol: Optional[int] = None
    fk_embarcacion: Optional[int] = None
    id_tablilla: Optional[str] = None
    activo: Optional[bool] = None


def rut_for_email(email: str) -> str:
    digest = hashlib.sha1(email.strip().lower().encode("utf-8")).hexdigest()
    return f"USR-{digest[:12]}"


ROLE_BY_ID = {
    1: "admin",
    2: "supervisor",
    3: "buzo",
}


def payload_email(payload) -> str:
    email = (getattr(payload, "correo", None) or getattr(payload, "username", None) or "").strip()
    if not email:
        raise HTTPException(status_code=422, detail="El correo es obligatorio")
    return email


def payload_role(payload) -> str:
    if getattr(payload, "rol", None):
        return payload.rol
    if getattr(payload, "fk_rol", None) in ROLE_BY_ID:
        return ROLE_BY_ID[payload.fk_rol]
    raise HTTPException(status_code=422, detail="El rol es obligatorio")


def validate_embarcacion(cur, fk_embarcacion: Optional[int]):
    if fk_embarcacion is None:
        return
    cur.execute(
        "SELECT id_embarcacion FROM embarcaciones WHERE id_embarcacion = %s LIMIT 1",
        (fk_embarcacion,)
    )
    if not cur.fetchone():
        raise HTTPException(status_code=400, detail="Embarcacion no encontrada")


def ensure_audit_table(cur):
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS auditoria_eventos (
            id_auditoria SERIAL PRIMARY KEY,
            fk_usuario INTEGER REFERENCES usuarios(id_usuario),
            accion TEXT NOT NULL,
            entidad TEXT,
            entidad_id TEXT,
            detalle JSONB,
            ip_origen TEXT,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.execute("ALTER TABLE auditoria_eventos ADD COLUMN IF NOT EXISTS username TEXT")
    cur.execute("ALTER TABLE auditoria_eventos ADD COLUMN IF NOT EXISTS rol TEXT")


def insert_audit(cur, current_user: dict, action: str, entity_id: str, detail: str):
    ensure_audit_table(cur)
    cur.execute(
        """
        INSERT INTO auditoria_eventos (
            fk_usuario,
            username,
            rol,
            accion,
            entidad,
            entidad_id,
            detalle,
            created_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s)
        """,
        (
            int(current_user["id"]),
            current_user["username"],
            current_user["role"],
            action,
            "usuarios",
            entity_id,
            detail,
            app_now_naive(),
        )
    )

@router.post("/users")
def create_user(
    payload: CreateUserPayload,
    current_user: dict = Depends(require_roles(["admin"]))
):
    conn = get_connection()

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        email = payload_email(payload)
        role_name = payload_role(payload)
        rut = (payload.rut or rut_for_email(email)).strip()
        id_tablilla = payload.id_tablilla.strip() if payload.id_tablilla else None
        validate_embarcacion(cur, payload.fk_embarcacion)

        cur.execute(
            """
            SELECT id_usuario
            FROM usuarios
            WHERE LOWER(correo) = LOWER(%s)
            LIMIT 1
            """,
            (email,)
        )

        if cur.fetchone():
            raise HTTPException(status_code=409, detail="El correo ya existe")

        cur.execute(
            """
            SELECT id_rol
            FROM roles
            WHERE LOWER(nombre_rol) = LOWER(%s)
            LIMIT 1
            """,
            (role_name,)
        )

        role_row = cur.fetchone()

        if not role_row:
            raise HTTPException(status_code=400, detail=f"Rol no encontrado: {role_name}")

        password_hash = hash_password(payload.password)
        timestamp = app_now_naive()

        cur.execute(
            """
            INSERT INTO usuarios (
                rut,
                correo,
                nombre_completo,
                password_hash,
                fk_rol,
                fk_embarcacion,
                id_tablilla,
                activo,
                created_at,
                updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, %s, %s)
            RETURNING id_usuario, correo, nombre_completo
            """,
            (
                rut,
                email,
                payload.nombre_completo,
                password_hash,
                role_row["id_rol"],
                payload.fk_embarcacion,
                id_tablilla,
                timestamp,
                timestamp,
            )
        )

        new_user = cur.fetchone()

        insert_audit(cur, current_user, "user_created", str(new_user["id_usuario"]), '{"source":"admin_panel"}')

        conn.commit()

        logger.info(
            "user_created username=%s role=%s created_by=%s",
            email,
            role_name,
            current_user["username"]
        )

        return {
            "status": "ok",
            "id_usuario": new_user["id_usuario"],
            "username": new_user["correo"],
            "correo": new_user["correo"],
            "nombre_completo": payload.nombre_completo,
            "rol": role_name,
            "fk_embarcacion": payload.fk_embarcacion,
            "id_tablilla": id_tablilla,
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
                u.correo AS username,
                u.correo,
                u.rut,
                u.nombre_completo,
                u.fk_rol,
                u.fk_embarcacion,
                u.id_tablilla,
                u.activo,
                u.created_at,
                u.last_login_at,
                r.nombre_rol AS rol,
                r.nombre_rol AS rol_nombre
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


@router.get("/users/analytics")
def users_analytics(
    current_user: dict = Depends(require_roles(["admin"]))
):
    conn = get_connection()

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE COALESCE(u.activo, TRUE) = TRUE) AS activos,
                COUNT(*) FILTER (WHERE COALESCE(u.activo, TRUE) = FALSE) AS inactivos,
                COUNT(*) FILTER (WHERE u.last_login_at IS NOT NULL) AS con_login,
                MAX(u.last_login_at) AS ultimo_login
            FROM usuarios u
            """
        )
        summary = cur.fetchone() or {}

        cur.execute(
            """
            SELECT LOWER(r.nombre_rol) AS rol, COUNT(*) AS total
            FROM usuarios u
            JOIN roles r ON r.id_rol = u.fk_rol
            GROUP BY LOWER(r.nombre_rol)
            ORDER BY total DESC
            """
        )
        roles = cur.fetchall()

        cur.execute(
            """
            SELECT
                COALESCE(u.nombre_completo, u.correo, 'Sin usuario') AS usuario,
                COUNT(rocr.id_registro) AS digitalizaciones,
                COUNT(rocr.id_registro) FILTER (WHERE rocr.estado_validacion = 'VALIDADO') AS validadas
            FROM usuarios u
            LEFT JOIN registros_ocr rocr
                ON rocr.fk_usuario_creador = u.id_usuario
               AND UPPER(COALESCE(rocr.estado_validacion, '')) <> 'ELIMINADO'
            GROUP BY u.id_usuario, u.nombre_completo, u.correo
            ORDER BY digitalizaciones DESC, usuario ASC
            LIMIT 6
            """
        )
        activity = cur.fetchall()

        ensure_audit_table(cur)
        cur.execute(
            """
            SELECT accion, entidad_id, username, rol, created_at
            FROM auditoria_eventos
            WHERE entidad = 'usuarios'
            ORDER BY created_at DESC
            LIMIT 8
            """
        )
        audit = cur.fetchall()
        conn.commit()

        return {
            "summary": summary,
            "roles": roles,
            "activity": activity,
            "audit": audit,
        }
    finally:
        conn.close()


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: UpdateUserPayload,
    current_user: dict = Depends(require_roles(["admin"]))
):
    conn = get_connection()

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id_usuario FROM usuarios WHERE id_usuario = %s", (user_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        updates = []
        params = []

        next_email = payload.correo or payload.username
        if next_email is not None:
            cur.execute(
                "SELECT id_usuario FROM usuarios WHERE LOWER(correo) = LOWER(%s) AND id_usuario <> %s LIMIT 1",
                (next_email, user_id)
            )
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="El correo ya existe")
            updates.append("correo = %s")
            params.append(next_email)

        if payload.nombre_completo is not None:
            updates.append("nombre_completo = %s")
            params.append(payload.nombre_completo)

        if payload.password is not None:
            updates.append("password_hash = %s")
            params.append(hash_password(payload.password))

        role_for_update = payload.rol or ROLE_BY_ID.get(payload.fk_rol or 0)
        if role_for_update is not None:
            cur.execute(
                "SELECT id_rol FROM roles WHERE LOWER(nombre_rol) = LOWER(%s) LIMIT 1",
                (role_for_update,)
            )
            role_row = cur.fetchone()
            if not role_row:
                raise HTTPException(status_code=400, detail=f"Rol no encontrado: {role_for_update}")
            updates.append("fk_rol = %s")
            params.append(role_row["id_rol"])

        if payload.fk_embarcacion is not None:
            validate_embarcacion(cur, payload.fk_embarcacion)
            updates.append("fk_embarcacion = %s")
            params.append(payload.fk_embarcacion)

        if payload.id_tablilla is not None:
            updates.append("id_tablilla = %s")
            params.append(payload.id_tablilla.strip() or None)

        if payload.activo is not None:
            updates.append("activo = %s")
            params.append(payload.activo)

        if not updates:
            return {"status": "ok", "id_usuario": user_id, "updated": False}

        updates.append("updated_at = %s")
        params.append(app_now_naive())
        params.append(user_id)

        cur.execute(
            f"UPDATE usuarios SET {', '.join(updates)} WHERE id_usuario = %s RETURNING id_usuario",
            params
        )
        insert_audit(cur, current_user, "user_updated", str(user_id), '{"source":"admin_panel"}')
        conn.commit()

        return {"status": "ok", "id_usuario": user_id, "updated": True}

    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        logger.exception("user_update_error")
        raise HTTPException(status_code=500, detail="Error interno al actualizar usuario")
    finally:
        conn.close()


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    hard: bool = Query(False),
    current_user: dict = Depends(require_roles(["admin"]))
):
    if int(current_user["id"]) == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")

    conn = get_connection()

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        timestamp = app_now_naive()

        if hard:
            cur.execute(
                """
                SELECT COUNT(*) AS total
                FROM registros_ocr
                WHERE fk_usuario_creador = %s
                """,
                (user_id,)
            )
            if int((cur.fetchone() or {}).get("total") or 0) > 0:
                raise HTTPException(
                    status_code=409,
                    detail="El usuario tiene registros asociados. Desactivalo para conservar trazabilidad."
                )
            cur.execute("DELETE FROM usuarios WHERE id_usuario = %s RETURNING id_usuario", (user_id,))
            action = "user_deleted"
        else:
            cur.execute(
                """
                UPDATE usuarios
                SET activo = FALSE, updated_at = %s
                WHERE id_usuario = %s
                RETURNING id_usuario
                """,
                (timestamp, user_id)
            )
            action = "user_deactivated"

        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        insert_audit(cur, current_user, action, str(user_id), '{"source":"admin_panel"}')
        conn.commit()
        return {"status": "ok", "id_usuario": user_id, "action": action}

    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        logger.exception("user_delete_error")
        raise HTTPException(status_code=500, detail="Error interno al eliminar usuario")
    finally:
        conn.close()
