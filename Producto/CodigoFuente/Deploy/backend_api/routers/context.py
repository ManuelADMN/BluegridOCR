from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from services.db import get_connection
from psycopg2.extras import RealDictCursor
from dependencies.auth import require_roles

router = APIRouter(tags=["Contexto"])


class CreateEmbarcacionPayload(BaseModel):
    matricula: str = Field(..., min_length=2)
    nombre_nave: str = Field(..., min_length=2)
    capacidad_personas: int = Field(0, ge=0)
    estado: str = "ACTIVA"


class CreateTablillaPayload(BaseModel):
    codigo_tablilla: str = Field(..., min_length=2)
    fk_embarcacion: int | None = None
    nombre_referencia: str | None = None
    descripcion: str | None = None
    estado: str = "ACTIVA"


class UpdateTablillaPayload(BaseModel):
    fk_embarcacion: int | None = None
    nombre_referencia: str | None = None
    descripcion: str | None = None
    estado: str | None = None


def ensure_operational_tables(cur):
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS tablillas (
            id_tablilla       SERIAL PRIMARY KEY,
            codigo_tablilla   TEXT NOT NULL UNIQUE,
            fk_embarcacion    INTEGER REFERENCES embarcaciones(id_embarcacion) ON DELETE RESTRICT,
            nombre_referencia TEXT,
            descripcion       TEXT,
            estado            TEXT DEFAULT 'ACTIVA',
            origen            TEXT DEFAULT 'ADMIN_PANEL',
            created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by        INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
            updated_by        INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL
        )
        """
    )
    cur.execute("ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS codigo_tablilla TEXT")
    cur.execute("ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS fk_embarcacion INTEGER REFERENCES embarcaciones(id_embarcacion) ON DELETE RESTRICT")
    cur.execute("ALTER TABLE tablillas ALTER COLUMN fk_embarcacion DROP NOT NULL")
    cur.execute("ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS nombre_referencia TEXT")
    cur.execute("ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS descripcion TEXT")
    cur.execute("ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'ACTIVA'")
    cur.execute("ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'ADMIN_PANEL'")
    cur.execute("ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    cur.execute("ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    cur.execute("ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL")
    cur.execute("ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL")
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS tablilla_embarcacion_historial (
            id_historial   SERIAL PRIMARY KEY,
            fk_tablilla    INTEGER NOT NULL REFERENCES tablillas(id_tablilla) ON DELETE CASCADE,
            fk_embarcacion INTEGER NOT NULL REFERENCES embarcaciones(id_embarcacion) ON DELETE RESTRICT,
            fecha_inicio   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_fin      TIMESTAMP,
            activo         BOOLEAN DEFAULT TRUE,
            asignado_por   INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
            motivo         TEXT,
            created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.execute("ALTER TABLE tablilla_embarcacion_historial ADD COLUMN IF NOT EXISTS fk_tablilla INTEGER REFERENCES tablillas(id_tablilla) ON DELETE CASCADE")
    cur.execute("ALTER TABLE tablilla_embarcacion_historial ADD COLUMN IF NOT EXISTS fk_embarcacion INTEGER REFERENCES embarcaciones(id_embarcacion) ON DELETE RESTRICT")
    cur.execute("ALTER TABLE tablilla_embarcacion_historial ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    cur.execute("ALTER TABLE tablilla_embarcacion_historial ADD COLUMN IF NOT EXISTS fecha_fin TIMESTAMP")
    cur.execute("ALTER TABLE tablilla_embarcacion_historial ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE")
    cur.execute("ALTER TABLE tablilla_embarcacion_historial ADD COLUMN IF NOT EXISTS asignado_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL")
    cur.execute("ALTER TABLE tablilla_embarcacion_historial ADD COLUMN IF NOT EXISTS motivo TEXT")
    cur.execute("ALTER TABLE tablilla_embarcacion_historial ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    cur.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_tablillas_codigo') THEN
                ALTER TABLE tablillas ADD CONSTRAINT uk_tablillas_codigo UNIQUE (codigo_tablilla);
            END IF;
        END $$
        """
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_tablillas_fk_embarcacion ON tablillas(fk_embarcacion)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_tablillas_estado ON tablillas(estado)")
    cur.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uk_tablilla_embarcacion_activa
        ON tablilla_embarcacion_historial(fk_tablilla)
        WHERE activo = TRUE
        """
    )


def validate_estado_embarcacion(estado: str):
    if estado not in {"ACTIVA", "INACTIVA", "MANTENCION", "BAJA"}:
        raise HTTPException(status_code=422, detail="Estado de embarcacion no permitido")

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
        ensure_operational_tables(cur)
        cur.execute(
            """
            SELECT
                e.id_embarcacion AS id,
                e.nombre_nave AS name,
                e.matricula,
                e.capacidad_personas,
                e.estado,
                COUNT(t.id_tablilla) FILTER (WHERE COALESCE(t.estado, 'ACTIVA') = 'ACTIVA') AS tablas_asociadas
            FROM embarcaciones e
            LEFT JOIN tablillas t ON t.fk_embarcacion = e.id_embarcacion
            GROUP BY e.id_embarcacion, e.nombre_nave, e.matricula, e.capacidad_personas, e.estado
            ORDER BY e.nombre_nave ASC
            """
        )
        rows = cur.fetchall()
        conn.commit()
        return rows
    finally:
        conn.close()


@router.post("/context/embarcaciones")
def create_embarcacion(
    payload: CreateEmbarcacionPayload,
    current_user: dict = Depends(require_roles(["admin"]))
):
    matricula = payload.matricula.strip().upper()
    nombre_nave = payload.nombre_nave.strip()
    estado = payload.estado.strip().upper() or "ACTIVA"

    if estado not in {"ACTIVA", "INACTIVA", "MANTENCION", "BAJA"}:
        raise HTTPException(status_code=422, detail="Estado de embarcacion no permitido")

    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        validate_estado_embarcacion(estado)
        cur.execute(
            """
            INSERT INTO embarcaciones (
                matricula,
                nombre_nave,
                capacidad_personas,
                estado
            )
            VALUES (%s, %s, %s, %s)
            RETURNING
                id_embarcacion AS id,
                nombre_nave AS name,
                matricula,
                capacidad_personas,
                estado
            """,
            (
                matricula,
                nombre_nave,
                payload.capacidad_personas,
                estado,
            )
        )
        row = cur.fetchone()
        conn.commit()
        return row
    except Exception as exc:
        conn.rollback()
        if "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
            raise HTTPException(status_code=409, detail="La matricula ya existe")
        raise HTTPException(status_code=500, detail="Error interno al crear embarcacion")
    finally:
        conn.close()


@router.get("/context/tablillas")
def get_tablillas(
    current_user: dict = Depends(require_roles(["admin", "supervisor", "buzo"]))
):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        ensure_operational_tables(cur)
        cur.execute(
            """
            SELECT
                t.id_tablilla AS id,
                t.codigo_tablilla,
                t.fk_embarcacion,
                e.nombre_nave AS embarcacion,
                e.matricula,
                t.nombre_referencia,
                t.descripcion,
                t.estado,
                t.origen,
                t.created_at,
                t.updated_at
            FROM tablillas t
            LEFT JOIN embarcaciones e ON e.id_embarcacion = t.fk_embarcacion
            ORDER BY t.updated_at DESC, t.id_tablilla DESC
            """
        )
        rows = cur.fetchall()
        conn.commit()
        return rows
    finally:
        conn.close()


@router.post("/context/tablillas")
def create_tablilla(
    payload: CreateTablillaPayload,
    current_user: dict = Depends(require_roles(["admin"]))
):
    codigo = payload.codigo_tablilla.strip().upper()
    estado = payload.estado.strip().upper() or "ACTIVA"
    validate_estado_embarcacion(estado)

    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        ensure_operational_tables(cur)
        if payload.fk_embarcacion is not None:
            cur.execute(
                "SELECT id_embarcacion FROM embarcaciones WHERE id_embarcacion = %s LIMIT 1",
                (payload.fk_embarcacion,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=400, detail="Embarcacion no encontrada")

        cur.execute(
            """
            INSERT INTO tablillas (
                codigo_tablilla,
                fk_embarcacion,
                nombre_referencia,
                descripcion,
                estado,
                origen,
                created_by,
                updated_by,
                created_at,
                updated_at
            )
            VALUES (%s, %s, %s, %s, %s, 'ADMIN_PANEL', %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id_tablilla AS id, codigo_tablilla, fk_embarcacion, nombre_referencia, descripcion, estado
            """,
            (
                codigo,
                payload.fk_embarcacion,
                payload.nombre_referencia,
                payload.descripcion,
                estado,
                int(current_user["id"]),
                int(current_user["id"]),
            )
        )
        row = cur.fetchone()
        if payload.fk_embarcacion is not None:
            cur.execute(
                """
                INSERT INTO tablilla_embarcacion_historial (
                    fk_tablilla,
                    fk_embarcacion,
                    activo,
                    asignado_por,
                    motivo,
                    created_at
                )
                VALUES (%s, %s, TRUE, %s, 'Creada y asociada desde panel administrativo', CURRENT_TIMESTAMP)
                ON CONFLICT DO NOTHING
                """,
                (row["id"], payload.fk_embarcacion, int(current_user["id"]))
            )
        conn.commit()
        return row
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        conn.rollback()
        if "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
            raise HTTPException(status_code=409, detail="El codigo de tabla ya existe")
        raise HTTPException(status_code=500, detail="Error interno al crear tabla")
    finally:
        conn.close()


@router.patch("/context/tablillas/{tablilla_id}")
def update_tablilla(
    tablilla_id: int,
    payload: UpdateTablillaPayload,
    current_user: dict = Depends(require_roles(["admin"]))
):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        ensure_operational_tables(cur)
        cur.execute(
            "SELECT id_tablilla, fk_embarcacion FROM tablillas WHERE id_tablilla = %s FOR UPDATE",
            (tablilla_id,)
        )
        current = cur.fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="Tabla no encontrada")

        updates = []
        params = []
        if payload.fk_embarcacion is not None:
            cur.execute(
                "SELECT id_embarcacion FROM embarcaciones WHERE id_embarcacion = %s LIMIT 1",
                (payload.fk_embarcacion,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=400, detail="Embarcacion no encontrada")
            updates.append("fk_embarcacion = %s")
            params.append(payload.fk_embarcacion)
        if payload.nombre_referencia is not None:
            updates.append("nombre_referencia = %s")
            params.append(payload.nombre_referencia.strip() or None)
        if payload.descripcion is not None:
            updates.append("descripcion = %s")
            params.append(payload.descripcion.strip() or None)
        if payload.estado is not None:
            estado = payload.estado.strip().upper()
            validate_estado_embarcacion(estado)
            updates.append("estado = %s")
            params.append(estado)

        if not updates:
            return {"status": "ok", "updated": False}

        updates.extend(["updated_by = %s", "updated_at = CURRENT_TIMESTAMP"])
        params.append(int(current_user["id"]))
        params.append(tablilla_id)
        cur.execute(
            f"UPDATE tablillas SET {', '.join(updates)} WHERE id_tablilla = %s RETURNING id_tablilla AS id",
            params
        )

        if payload.fk_embarcacion is not None and payload.fk_embarcacion != current["fk_embarcacion"]:
            cur.execute(
                """
                UPDATE tablilla_embarcacion_historial
                SET activo = FALSE,
                    fecha_fin = CURRENT_TIMESTAMP
                WHERE fk_tablilla = %s
                  AND activo = TRUE
                """,
                (tablilla_id,)
            )
            cur.execute(
                """
                INSERT INTO tablilla_embarcacion_historial (
                    fk_tablilla,
                    fk_embarcacion,
                    activo,
                    asignado_por,
                    motivo,
                    created_at
                )
                VALUES (%s, %s, TRUE, %s, 'Reasignada desde panel administrativo', CURRENT_TIMESTAMP)
                """,
                (tablilla_id, payload.fk_embarcacion, int(current_user["id"]))
            )

        conn.commit()
        return {"status": "ok", "updated": True, "id": tablilla_id}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Error interno al actualizar tabla")
    finally:
        conn.close()
