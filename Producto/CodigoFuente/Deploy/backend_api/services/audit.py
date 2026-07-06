from typing import Any

from psycopg2.extras import Json

from services.timezone import app_now_naive


def ensure_audit_table(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS auditoria_eventos (
            id_auditoria SERIAL PRIMARY KEY,
            fk_usuario INTEGER REFERENCES usuarios(id_usuario),
            username TEXT,
            rol TEXT,
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


def insert_audit_event(
    cur,
    current_user: dict,
    *,
    action: str,
    entity: str,
    entity_id: str | int | None = None,
    detail: Any = None,
    ip_origin: str | None = None,
    user_agent: str | None = None,
) -> None:
    ensure_audit_table(cur)
    cur.execute(
        """
        INSERT INTO auditoria_eventos (
            fk_usuario, username, rol, accion, entidad, entidad_id,
            detalle, ip_origen, user_agent, created_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            int(current_user["id"]),
            current_user.get("username"),
            current_user.get("role"),
            action,
            entity,
            str(entity_id) if entity_id is not None else None,
            Json(detail if detail is not None else {}),
            ip_origin,
            user_agent,
            app_now_naive(),
        ),
    )
