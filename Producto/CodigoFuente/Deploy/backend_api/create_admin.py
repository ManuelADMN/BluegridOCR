import argparse
import getpass
import hashlib
import os
import sys

import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings
from services.security import hash_password


def get_password(args: argparse.Namespace) -> str:
    password = args.password or os.getenv("ADMIN_PASSWORD")

    if password:
        return password

    if not sys.stdin.isatty():
        raise RuntimeError(
            "No se recibio password. Define ADMIN_PASSWORD o usa --password en un entorno no interactivo."
        )

    first = getpass.getpass("Nueva password admin: ")
    second = getpass.getpass("Confirmar password admin: ")

    if first != second:
        raise RuntimeError("Las passwords no coinciden.")

    return first


def ensure_admin_role(cur) -> int:
    cur.execute(
        """
        INSERT INTO roles (nombre_rol)
        SELECT 'admin'
        WHERE NOT EXISTS (
            SELECT 1 FROM roles WHERE LOWER(nombre_rol) = 'admin'
        )
        """
    )

    cur.execute(
        """
        SELECT id_rol
        FROM roles
        WHERE LOWER(nombre_rol) = 'admin'
        LIMIT 1
        """
    )
    row = cur.fetchone()

    if not row:
        raise RuntimeError("No se pudo encontrar o crear el rol admin.")

    return row["id_rol"]


def rut_for_email(email: str) -> str:
    digest = hashlib.sha1(email.strip().lower().encode("utf-8")).hexdigest()
    return f"USR-{digest[:12]}"


def upsert_admin(username: str, password: str) -> None:
    if len(password) < 8:
        raise RuntimeError("La password debe tener al menos 8 caracteres.")

    password_hash = hash_password(password)

    conn = psycopg2.connect(settings.DATABASE_URL)

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT set_config('app.role', %s, true)", ("admin",))
            cur.execute("SELECT set_config('app.email', %s, true)", (username,))
            cur.execute("SELECT set_config('app.source', %s, true)", ("create_admin.py",))

            admin_role_id = ensure_admin_role(cur)

            cur.execute(
                """
                SELECT id_usuario
                FROM usuarios
                WHERE LOWER(correo) = LOWER(%s)
                LIMIT 1
                """,
                (username,),
            )
            existing_admin = cur.fetchone()

            if existing_admin:
                cur.execute(
                    """
                    UPDATE usuarios
                    SET
                        password_hash = %s,
                        fk_rol = %s,
                        correo = %s,
                        activo = TRUE,
                        updated_at = NOW()
                    WHERE id_usuario = %s
                    """,
                    (password_hash, admin_role_id, username, existing_admin["id_usuario"]),
                )
                print(f"Usuario '{username}' actualizado como admin.")
            else:
                cur.execute(
                    """
                    INSERT INTO usuarios (
                        rut,
                        nombre_completo,
                        correo,
                        password_hash,
                        fk_rol,
                        activo,
                        created_at,
                        updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, TRUE, NOW(), NOW())
                    """,
                    (
                        rut_for_email(username),
                        "Administrador General",
                        username,
                        password_hash,
                        admin_role_id,
                    ),
                )
                print(f"Usuario '{username}' creado como admin.")

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crea o recupera un usuario administrador de BluegridOCR."
    )
    parser.add_argument("--username", default="admin@bluegrid.cl", help="Correo a crear o recuperar.")
    parser.add_argument(
        "--password",
        help="Nueva password. Para evitar historial de shell, prefiere ADMIN_PASSWORD o el prompt.",
    )
    args = parser.parse_args()

    password = get_password(args)
    upsert_admin(args.username, password)
    print("Listo. Ya puedes iniciar sesion con ese usuario.")


if __name__ == "__main__":
    main()
