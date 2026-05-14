-- ============================================================================
-- BLUEGRIDOCR - BASE DE DATOS COMPLETA PARA SUPABASE / POSTGRESQL
-- ============================================================================
-- Archivo completo para preparar la BDD que consume el backend FastAPI.
--
-- Login admin inicial:
--   usuario:  admin@bluegrid.cl
--   password: <PASSWORD_ADMIN_DEFINIDA_EN_INFORME>
--
-- Notas de compatibilidad:
--   - El frontend llama al identificador como "username".
--   - El backend mapea ese "username" a usuarios.correo.
--   - No se crea columna usuarios.username; la fuente real es correo.
--   - El script es idempotente: se puede ejecutar varias veces.
--   - Se agregan tablillas, asignaciones operativas y diccionarios OCR por buzo.
--   - Azure Blob Storage aun no esta implementado, pero quedan columnas preparadas.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. EXTENSIONES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. TABLAS MAESTRAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id_rol      SERIAL PRIMARY KEY,
    nombre_rol  TEXT NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS sectores (
    id_sector     SERIAL PRIMARY KEY,
    nombre_sector TEXT NOT NULL,
    region_chile  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS embarcaciones (
    id_embarcacion     SERIAL PRIMARY KEY,
    matricula          TEXT NOT NULL UNIQUE,
    nombre_nave        TEXT NOT NULL,
    capacidad_personas INTEGER DEFAULT 0,
    estado             TEXT DEFAULT 'ACTIVA'
);

CREATE TABLE IF NOT EXISTS embarcacion_sectores (
    id_relacion    SERIAL PRIMARY KEY,
    fk_embarcacion INTEGER NOT NULL REFERENCES embarcaciones(id_embarcacion) ON DELETE CASCADE,
    fk_sector      INTEGER NOT NULL REFERENCES sectores(id_sector) ON DELETE CASCADE
);

-- ============================================================================
-- 2. USUARIOS Y SEGURIDAD
-- ============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario      SERIAL PRIMARY KEY,
    rut             TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    correo          TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    fk_rol          INTEGER NOT NULL REFERENCES roles(id_rol),
    id_tablilla     TEXT,
    fk_embarcacion  INTEGER REFERENCES embarcaciones(id_embarcacion) ON DELETE SET NULL,
    activo          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP
);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rut TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre_completo TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS correo TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fk_rol INTEGER REFERENCES roles(id_rol);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS id_tablilla TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fk_embarcacion INTEGER REFERENCES embarcaciones(id_embarcacion) ON DELETE SET NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- ============================================================================
-- 3. TABLILLAS, EMBARCACIONES Y ASIGNACIONES OPERATIVAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tablillas (
    id_tablilla          SERIAL PRIMARY KEY,
    codigo_tablilla      TEXT NOT NULL,
    fk_embarcacion       INTEGER NOT NULL REFERENCES embarcaciones(id_embarcacion) ON DELETE RESTRICT,
    nombre_referencia    TEXT,
    descripcion          TEXT,
    estado               TEXT DEFAULT 'ACTIVA',
    origen               TEXT DEFAULT 'CLAUDE_VISION',
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by           INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    updated_by           INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS codigo_tablilla TEXT;
ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS fk_embarcacion INTEGER REFERENCES embarcaciones(id_embarcacion) ON DELETE RESTRICT;
ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS nombre_referencia TEXT;
ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'ACTIVA';
ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'CLAUDE_VISION';
ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE tablillas ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS tablilla_embarcacion_historial (
    id_historial         SERIAL PRIMARY KEY,
    fk_tablilla          INTEGER NOT NULL REFERENCES tablillas(id_tablilla) ON DELETE CASCADE,
    fk_embarcacion       INTEGER NOT NULL REFERENCES embarcaciones(id_embarcacion) ON DELETE RESTRICT,
    fecha_inicio         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin            TIMESTAMP,
    activo               BOOLEAN DEFAULT TRUE,
    asignado_por         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    motivo               TEXT,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fk_tablilla INTEGER REFERENCES tablillas(id_tablilla) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS usuario_asignaciones_operativas (
    id_asignacion        SERIAL PRIMARY KEY,
    fk_usuario           INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    fk_embarcacion       INTEGER NOT NULL REFERENCES embarcaciones(id_embarcacion) ON DELETE RESTRICT,
    fk_tablilla          INTEGER REFERENCES tablillas(id_tablilla) ON DELETE SET NULL,
    fecha_inicio         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin            TIMESTAMP,
    activo               BOOLEAN DEFAULT TRUE,
    asignado_por         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    motivo               TEXT,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. OCR Y VALIDACION
-- ============================================================================

CREATE TABLE IF NOT EXISTS registros_ocr (
    id_registro              SERIAL PRIMARY KEY,
    fk_usuario_creador       INTEGER NOT NULL REFERENCES usuarios(id_usuario),
    fk_sector                INTEGER REFERENCES sectores(id_sector) ON DELETE SET NULL,
    fk_embarcacion           INTEGER REFERENCES embarcaciones(id_embarcacion) ON DELETE SET NULL,
    fk_tablilla              INTEGER REFERENCES tablillas(id_tablilla) ON DELETE SET NULL,
    tablilla_codigo_detectado TEXT,
    fecha_carga              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    url_imagen_original      TEXT NOT NULL,
    url_imagen_procesada     TEXT,
    azure_blob_container     TEXT,
    azure_blob_path          TEXT,
    azure_blob_url           TEXT,
    azure_blob_etag          TEXT,
    azure_blob_metadata      JSONB,
    estado_validacion        TEXT DEFAULT 'BORRADOR',
    alerta_confianza         INTEGER DEFAULT 0,
    promedio_confianza       NUMERIC(5,4),
    rechazo_motivo           TEXT,
    updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at             TIMESTAMP,
    validated_by             INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS fk_usuario_creador INTEGER REFERENCES usuarios(id_usuario);
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS fk_sector INTEGER REFERENCES sectores(id_sector) ON DELETE SET NULL;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS fk_embarcacion INTEGER REFERENCES embarcaciones(id_embarcacion) ON DELETE SET NULL;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS fk_tablilla INTEGER REFERENCES tablillas(id_tablilla) ON DELETE SET NULL;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS tablilla_codigo_detectado TEXT;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS fecha_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS url_imagen_original TEXT;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS url_imagen_procesada TEXT;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS azure_blob_container TEXT;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS azure_blob_path TEXT;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS azure_blob_url TEXT;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS azure_blob_etag TEXT;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS azure_blob_metadata JSONB;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS estado_validacion TEXT DEFAULT 'BORRADOR';
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS alerta_confianza INTEGER DEFAULT 0;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS promedio_confianza NUMERIC(5,4);
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS rechazo_motivo TEXT;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS validated_by INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS detalles_captura (
    id_detalle           SERIAL PRIMARY KEY,
    fk_registro          INTEGER NOT NULL REFERENCES registros_ocr(id_registro) ON DELETE CASCADE,
    fila_index           INTEGER NOT NULL,
    n_nidos              INTEGER DEFAULT 0,
    n_cuevas_cubiertas   INTEGER DEFAULT 0,
    captura_hembras_tipo INTEGER DEFAULT 0,
    total_pulpos         INTEGER DEFAULT 0,
    datos_editados       INTEGER DEFAULT 0,
    confianza_fila       NUMERIC(5,4),
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    editado_por          INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS feedback_ia (
    id_feedback          SERIAL PRIMARY KEY,
    fk_usuario           INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    fk_sector            INTEGER REFERENCES sectores(id_sector) ON DELETE SET NULL,
    fk_registro          INTEGER REFERENCES registros_ocr(id_registro) ON DELETE SET NULL,
    ref_id               TEXT,
    valor_original       TEXT,
    valor_corregido      TEXT,
    recorte_base64       TEXT,
    azure_blob_container TEXT,
    azure_blob_path      TEXT,
    azure_blob_url       TEXT,
    azure_blob_etag      TEXT,
    azure_blob_metadata  JSONB,
    fecha_feedback       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS ref_id TEXT;
ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS azure_blob_container TEXT;
ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS azure_blob_path TEXT;
ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS azure_blob_url TEXT;
ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS azure_blob_etag TEXT;
ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS azure_blob_metadata JSONB;

-- ============================================================================
-- 5. DICCIONARIO OCR DEL BUZO PARA CONTEXTO CLAUDE
-- ============================================================================

CREATE TABLE IF NOT EXISTS diccionarios_buzo (
    id_diccionario       SERIAL PRIMARY KEY,
    fk_usuario           INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    fk_embarcacion       INTEGER REFERENCES embarcaciones(id_embarcacion) ON DELETE SET NULL,
    fk_tablilla          INTEGER REFERENCES tablillas(id_tablilla) ON DELETE SET NULL,
    nombre_diccionario   TEXT NOT NULL DEFAULT 'Diccionario OCR Buzo',
    descripcion          TEXT,
    version              INTEGER DEFAULT 1,
    estado               TEXT DEFAULT 'ACTIVO',
    prioridad_contexto   INTEGER DEFAULT 1,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS diccionario_buzo_items (
    id_item              SERIAL PRIMARY KEY,
    fk_diccionario       INTEGER NOT NULL REFERENCES diccionarios_buzo(id_diccionario) ON DELETE CASCADE,
    ref_id               TEXT NOT NULL,
    fila_index           INTEGER,
    columna_index        INTEGER,
    valor_original       TEXT,
    valor_corregido      TEXT,
    etiqueta_contexto    TEXT,
    notas                TEXT,
    prioridad_contexto   INTEGER DEFAULT 1,
    recorte_base64       TEXT,
    azure_blob_container TEXT,
    azure_blob_path      TEXT,
    azure_blob_url       TEXT,
    azure_blob_etag      TEXT,
    azure_blob_metadata  JSONB,
    activo               BOOLEAN DEFAULT TRUE,
    usos_contexto        INTEGER DEFAULT 0,
    ultimo_uso_at        TIMESTAMP,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS fk_diccionario_item INTEGER REFERENCES diccionario_buzo_items(id_item) ON DELETE SET NULL;

-- ============================================================================
-- 6. AUDITORIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS auditoria_eventos (
    id_auditoria SERIAL PRIMARY KEY,
    fk_usuario   INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    rut          TEXT,
    username     TEXT,
    rol          TEXT,
    accion       TEXT NOT NULL,
    entidad      TEXT,
    entidad_id   TEXT,
    detalle      JSONB,
    ip_origen    TEXT,
    user_agent   TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE auditoria_eventos ADD COLUMN IF NOT EXISTS rut TEXT;
ALTER TABLE auditoria_eventos ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE auditoria_eventos ADD COLUMN IF NOT EXISTS rol TEXT;
ALTER TABLE auditoria_eventos ADD COLUMN IF NOT EXISTS entidad TEXT;
ALTER TABLE auditoria_eventos ADD COLUMN IF NOT EXISTS entidad_id TEXT;
ALTER TABLE auditoria_eventos ADD COLUMN IF NOT EXISTS detalle JSONB;
ALTER TABLE auditoria_eventos ADD COLUMN IF NOT EXISTS ip_origen TEXT;
ALTER TABLE auditoria_eventos ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE auditoria_eventos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- 7. CONSTRAINTS IDEMPOTENTES
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_sector_region') THEN
        ALTER TABLE sectores ADD CONSTRAINT uk_sector_region UNIQUE (nombre_sector, region_chile);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_embarcacion_sector') THEN
        ALTER TABLE embarcacion_sectores ADD CONSTRAINT uk_embarcacion_sector UNIQUE (fk_embarcacion, fk_sector);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_usuario_rut') THEN
        ALTER TABLE usuarios ADD CONSTRAINT uk_usuario_rut UNIQUE (rut);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_usuario_correo') THEN
        ALTER TABLE usuarios ADD CONSTRAINT uk_usuario_correo UNIQUE (correo);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_tablilla_por_barco') THEN
        ALTER TABLE usuarios ADD CONSTRAINT uk_tablilla_por_barco UNIQUE (id_tablilla, fk_embarcacion);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_tablillas_codigo') THEN
        ALTER TABLE tablillas ADD CONSTRAINT uk_tablillas_codigo UNIQUE (codigo_tablilla);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tablillas_estado') THEN
        ALTER TABLE tablillas ADD CONSTRAINT chk_tablillas_estado CHECK (
            estado IN ('ACTIVA', 'INACTIVA', 'MANTENCION', 'BAJA')
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_diccionarios_buzo_estado') THEN
        ALTER TABLE diccionarios_buzo ADD CONSTRAINT chk_diccionarios_buzo_estado CHECK (
            estado IN ('ACTIVO', 'INACTIVO', 'ARCHIVADO')
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_diccionario_item_ref_valor') THEN
        ALTER TABLE diccionario_buzo_items ADD CONSTRAINT uk_diccionario_item_ref_valor UNIQUE (
            fk_diccionario,
            ref_id,
            valor_corregido
        );
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_estado_validacion'
          AND conrelid = 'registros_ocr'::regclass
    ) THEN
        ALTER TABLE registros_ocr DROP CONSTRAINT chk_estado_validacion;
    END IF;

    ALTER TABLE registros_ocr ADD CONSTRAINT chk_estado_validacion CHECK (
        estado_validacion IN (
            'BORRADOR',
            'PENDIENTE_VALIDACION',
            'VALIDADO',
            'APROBADO',
            'RECHAZADO',
            'ELIMINADO'
        )
    );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_usuario_asignacion_activa
ON usuario_asignaciones_operativas(fk_usuario)
WHERE activo = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uk_tablilla_embarcacion_activa
ON tablilla_embarcacion_historial(fk_tablilla)
WHERE activo = TRUE;

-- ============================================================================
-- 8. INDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_usuarios_rut ON usuarios(rut);
CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo);
CREATE INDEX IF NOT EXISTS idx_usuarios_fk_rol ON usuarios(fk_rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_fk_embarcacion ON usuarios(fk_embarcacion);
CREATE INDEX IF NOT EXISTS idx_usuarios_fk_tablilla ON usuarios(fk_tablilla);

CREATE INDEX IF NOT EXISTS idx_tablillas_codigo ON tablillas(codigo_tablilla);
CREATE INDEX IF NOT EXISTS idx_tablillas_fk_embarcacion ON tablillas(fk_embarcacion);
CREATE INDEX IF NOT EXISTS idx_tablillas_estado ON tablillas(estado);
CREATE INDEX IF NOT EXISTS idx_tablilla_embarcacion_historial_tablilla ON tablilla_embarcacion_historial(fk_tablilla);
CREATE INDEX IF NOT EXISTS idx_tablilla_embarcacion_historial_embarcacion ON tablilla_embarcacion_historial(fk_embarcacion);

CREATE INDEX IF NOT EXISTS idx_usuario_asignaciones_usuario ON usuario_asignaciones_operativas(fk_usuario);
CREATE INDEX IF NOT EXISTS idx_usuario_asignaciones_embarcacion ON usuario_asignaciones_operativas(fk_embarcacion);
CREATE INDEX IF NOT EXISTS idx_usuario_asignaciones_tablilla ON usuario_asignaciones_operativas(fk_tablilla);

CREATE INDEX IF NOT EXISTS idx_registros_ocr_fk_usuario_creador ON registros_ocr(fk_usuario_creador);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_validated_by ON registros_ocr(validated_by);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_estado_validacion ON registros_ocr(estado_validacion);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_fecha_carga ON registros_ocr(fecha_carga);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_fk_sector ON registros_ocr(fk_sector);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_fk_embarcacion ON registros_ocr(fk_embarcacion);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_fk_tablilla ON registros_ocr(fk_tablilla);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_tablilla_codigo_detectado ON registros_ocr(tablilla_codigo_detectado);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_blob ON registros_ocr(azure_blob_container, azure_blob_path);

CREATE INDEX IF NOT EXISTS idx_detalles_captura_fk_registro ON detalles_captura(fk_registro);
CREATE INDEX IF NOT EXISTS idx_detalles_captura_editado_por ON detalles_captura(editado_por);

CREATE INDEX IF NOT EXISTS idx_feedback_ia_fk_usuario ON feedback_ia(fk_usuario);
CREATE INDEX IF NOT EXISTS idx_feedback_ia_fk_sector ON feedback_ia(fk_sector);
CREATE INDEX IF NOT EXISTS idx_feedback_ia_fk_registro ON feedback_ia(fk_registro);
CREATE INDEX IF NOT EXISTS idx_feedback_ia_usuario_ref ON feedback_ia(fk_usuario, ref_id);
CREATE INDEX IF NOT EXISTS idx_feedback_ia_diccionario_item ON feedback_ia(fk_diccionario_item);
CREATE INDEX IF NOT EXISTS idx_feedback_ia_blob ON feedback_ia(azure_blob_container, azure_blob_path);

CREATE INDEX IF NOT EXISTS idx_diccionarios_buzo_usuario ON diccionarios_buzo(fk_usuario);
CREATE INDEX IF NOT EXISTS idx_diccionarios_buzo_embarcacion ON diccionarios_buzo(fk_embarcacion);
CREATE INDEX IF NOT EXISTS idx_diccionarios_buzo_tablilla ON diccionarios_buzo(fk_tablilla);
CREATE INDEX IF NOT EXISTS idx_diccionarios_buzo_prioridad ON diccionarios_buzo(fk_usuario, prioridad_contexto);

CREATE INDEX IF NOT EXISTS idx_diccionario_buzo_items_diccionario ON diccionario_buzo_items(fk_diccionario);
CREATE INDEX IF NOT EXISTS idx_diccionario_buzo_items_ref ON diccionario_buzo_items(ref_id);
CREATE INDEX IF NOT EXISTS idx_diccionario_buzo_items_prioridad ON diccionario_buzo_items(fk_diccionario, prioridad_contexto);
CREATE INDEX IF NOT EXISTS idx_diccionario_buzo_items_blob ON diccionario_buzo_items(azure_blob_container, azure_blob_path);

CREATE INDEX IF NOT EXISTS idx_auditoria_fk_usuario ON auditoria_eventos(fk_usuario);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria_eventos(accion);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON auditoria_eventos(created_at);

-- ============================================================================
-- 9. INSERTS BASE
-- ============================================================================

INSERT INTO roles (nombre_rol, descripcion) VALUES
('admin', 'Control total del sistema'),
('supervisor', 'Valida registros OCR de los buzos'),
('buzo', 'Sube y digitaliza registros de muestreo')
ON CONFLICT (nombre_rol) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO sectores (nombre_sector, region_chile) VALUES
('Melinka', 'Aysen'),
('Huenquillahue', 'Aysen'),
('Ancud', 'Los Lagos')
ON CONFLICT (nombre_sector, region_chile) DO NOTHING;

INSERT INTO embarcaciones (matricula, nombre_nave, capacidad_personas, estado) VALUES
('CB-1001', 'El Poseidon', 15, 'ACTIVA'),
('VAL-2040', 'Mar del Sur', 8, 'ACTIVA'),
('PM-3055', 'La Tonina', 12, 'ACTIVA'),
('CHO-1102', 'Sirena I', 5, 'ACTIVA'),
('QLL-5001', 'Don Pepe', 4, 'ACTIVA'),
('ANC-8090', 'Australis', 20, 'ACTIVA'),
('TAL-2022', 'Tiburon Blanco', 6, 'ACTIVA'),
('CON-1010', 'Biobio Explorer', 10, 'ACTIVA'),
('PUN-6001', 'Magallanes I', 25, 'ACTIVA'),
('BUP-9999', 'Bluegrid Test', 50, 'ACTIVA')
ON CONFLICT (matricula) DO UPDATE SET
    nombre_nave = EXCLUDED.nombre_nave,
    capacidad_personas = EXCLUDED.capacidad_personas,
    estado = EXCLUDED.estado;

INSERT INTO embarcacion_sectores (fk_embarcacion, fk_sector)
SELECT e.id_embarcacion, s.id_sector
FROM embarcaciones e
CROSS JOIN sectores s
WHERE e.matricula IN ('CB-1001', 'BUP-9999', 'ANC-8090')
ON CONFLICT (fk_embarcacion, fk_sector) DO NOTHING;

-- ============================================================================
-- 10. USUARIOS INICIALES
-- ============================================================================

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
VALUES
(
    '11.111.111-1',
    'Administrador General',
    'admin@bluegrid.cl',
    crypt('<PASSWORD_ADMIN_DEFINIDA_EN_INFORME>', gen_salt('bf', 12)),
    (SELECT id_rol FROM roles WHERE nombre_rol = 'admin'),
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '22.222.222-2',
    'Supervisor Demo',
    'supervisor@bluegrid.cl',
    crypt('<PASSWORD_SUPERVISOR_DEMO>', gen_salt('bf', 12)),
    (SELECT id_rol FROM roles WHERE nombre_rol = 'supervisor'),
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '33.333.333-3',
    'Buzo Demo',
    'buzo@bluegrid.cl',
    crypt('<PASSWORD_BUZO_DEMO>', gen_salt('bf', 12)),
    (SELECT id_rol FROM roles WHERE nombre_rol = 'buzo'),
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (correo) DO UPDATE SET
    rut = EXCLUDED.rut,
    nombre_completo = EXCLUDED.nombre_completo,
    password_hash = EXCLUDED.password_hash,
    fk_rol = EXCLUDED.fk_rol,
    activo = TRUE,
    updated_at = CURRENT_TIMESTAMP;

UPDATE usuarios u
SET fk_embarcacion = e.id_embarcacion,
    id_tablilla = 'TAB-DEMO-001',
    updated_at = CURRENT_TIMESTAMP
FROM embarcaciones e
WHERE u.correo = 'buzo@bluegrid.cl'
  AND e.matricula = 'BUP-9999';

-- ============================================================================
-- 11. TABLILLA DEMO Y ASIGNACION DEMO SIN CAMBIAR DATOS BASE
-- ============================================================================

WITH demo_boat AS (
    SELECT id_embarcacion FROM embarcaciones WHERE matricula = 'BUP-9999' LIMIT 1
),
demo_admin AS (
    SELECT id_usuario FROM usuarios WHERE correo = 'admin@bluegrid.cl' LIMIT 1
),
upsert_tablilla AS (
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
    SELECT
        'TAB-DEMO-001',
        demo_boat.id_embarcacion,
        'Tablilla demo Bluegrid',
        'Tablilla inicial usada por el buzo demo',
        'ACTIVA',
        'SEED',
        demo_admin.id_usuario,
        demo_admin.id_usuario,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM demo_boat, demo_admin
    ON CONFLICT (codigo_tablilla) DO UPDATE SET
        fk_embarcacion = EXCLUDED.fk_embarcacion,
        nombre_referencia = EXCLUDED.nombre_referencia,
        descripcion = EXCLUDED.descripcion,
        estado = EXCLUDED.estado,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id_tablilla, fk_embarcacion
)
UPDATE usuarios u
SET fk_tablilla = upsert_tablilla.id_tablilla,
    updated_at = CURRENT_TIMESTAMP
FROM upsert_tablilla
WHERE u.correo = 'buzo@bluegrid.cl';

INSERT INTO tablilla_embarcacion_historial (
    fk_tablilla,
    fk_embarcacion,
    fecha_inicio,
    activo,
    asignado_por,
    motivo,
    created_at
)
SELECT
    t.id_tablilla,
    t.fk_embarcacion,
    CURRENT_TIMESTAMP,
    TRUE,
    a.id_usuario,
    'Asignacion seed inicial',
    CURRENT_TIMESTAMP
FROM tablillas t
LEFT JOIN usuarios a ON a.correo = 'admin@bluegrid.cl'
WHERE t.codigo_tablilla = 'TAB-DEMO-001'
ON CONFLICT DO NOTHING;

INSERT INTO usuario_asignaciones_operativas (
    fk_usuario,
    fk_embarcacion,
    fk_tablilla,
    fecha_inicio,
    activo,
    asignado_por,
    motivo,
    created_at,
    updated_at
)
SELECT
    u.id_usuario,
    e.id_embarcacion,
    t.id_tablilla,
    CURRENT_TIMESTAMP,
    TRUE,
    a.id_usuario,
    'Asignacion operativa seed inicial',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM usuarios u
JOIN embarcaciones e ON e.matricula = 'BUP-9999'
JOIN tablillas t ON t.codigo_tablilla = 'TAB-DEMO-001'
LEFT JOIN usuarios a ON a.correo = 'admin@bluegrid.cl'
WHERE u.correo = 'buzo@bluegrid.cl'
ON CONFLICT DO NOTHING;

INSERT INTO diccionarios_buzo (
    fk_usuario,
    fk_embarcacion,
    fk_tablilla,
    nombre_diccionario,
    descripcion,
    version,
    estado,
    prioridad_contexto,
    created_at,
    updated_at
)
SELECT
    u.id_usuario,
    e.id_embarcacion,
    t.id_tablilla,
    'Diccionario OCR Buzo Demo',
    'Contexto inicial para correcciones OCR por ref_id F1C1..F5C5',
    1,
    'ACTIVO',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM usuarios u
JOIN embarcaciones e ON e.matricula = 'BUP-9999'
JOIN tablillas t ON t.codigo_tablilla = 'TAB-DEMO-001'
WHERE u.correo = 'buzo@bluegrid.cl'
  AND NOT EXISTS (
      SELECT 1
      FROM diccionarios_buzo d
      WHERE d.fk_usuario = u.id_usuario
        AND d.fk_tablilla = t.id_tablilla
        AND d.estado = 'ACTIVO'
  );

-- ============================================================================
-- 12. DATOS DEMO MINIMOS PARA DASHBOARD / REPORTES
-- ============================================================================

WITH admin_user AS (
    SELECT id_usuario FROM usuarios WHERE correo = 'admin@bluegrid.cl'
),
melinka AS (
    SELECT id_sector FROM sectores WHERE nombre_sector = 'Melinka' LIMIT 1
),
demo_boat AS (
    SELECT id_embarcacion FROM embarcaciones WHERE matricula = 'BUP-9999' LIMIT 1
),
demo_tablilla AS (
    SELECT id_tablilla, codigo_tablilla FROM tablillas WHERE codigo_tablilla = 'TAB-DEMO-001' LIMIT 1
),
inserted AS (
    INSERT INTO registros_ocr (
        fk_usuario_creador,
        fk_sector,
        fk_embarcacion,
        fk_tablilla,
        tablilla_codigo_detectado,
        fecha_carga,
        url_imagen_original,
        url_imagen_procesada,
        estado_validacion,
        alerta_confianza,
        promedio_confianza,
        updated_at
    )
    SELECT
        admin_user.id_usuario,
        melinka.id_sector,
        demo_boat.id_embarcacion,
        demo_tablilla.id_tablilla,
        demo_tablilla.codigo_tablilla,
        CURRENT_TIMESTAMP,
        'seed://bluegrid/demo-original.jpg',
        'seed://bluegrid/demo-procesada.jpg',
        'VALIDADO',
        0,
        0.9700,
        CURRENT_TIMESTAMP
    FROM admin_user, melinka, demo_boat, demo_tablilla
    WHERE NOT EXISTS (
        SELECT 1 FROM registros_ocr WHERE url_imagen_original = 'seed://bluegrid/demo-original.jpg'
    )
    RETURNING id_registro
)
INSERT INTO detalles_captura (
    fk_registro,
    fila_index,
    n_nidos,
    n_cuevas_cubiertas,
    captura_hembras_tipo,
    total_pulpos,
    datos_editados,
    confianza_fila,
    updated_at
)
SELECT id_registro, 1, 6, 4, 2, 8, 0, 0.9800, CURRENT_TIMESTAMP FROM inserted
UNION ALL
SELECT id_registro, 2, 3, 2, 1, 5, 0, 0.9600, CURRENT_TIMESTAMP FROM inserted;

COMMIT;

-- ============================================================================
-- VERIFICACION RAPIDA
-- ============================================================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT * FROM roles ORDER BY id_rol;
-- SELECT id_usuario, rut, correo, nombre_completo, activo, fk_embarcacion, fk_tablilla FROM usuarios ORDER BY id_usuario;
-- SELECT codigo_tablilla, fk_embarcacion, estado FROM tablillas ORDER BY id_tablilla;
-- SELECT fk_usuario, fk_embarcacion, fk_tablilla, activo FROM usuario_asignaciones_operativas ORDER BY id_asignacion;
-- SELECT fk_usuario, fk_tablilla, estado FROM diccionarios_buzo ORDER BY id_diccionario;
-- SELECT COUNT(*) AS registros FROM registros_ocr;

