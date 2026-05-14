-- ============================================================================
-- BLUEGRIDOCR - BASE DE DATOS COMPLETA PARA SUPABASE / POSTGRESQL
-- ============================================================================
-- Archivo oficial para preparar la BDD que consume el backend FastAPI.
--
-- Login admin inicial:
--   usuario:  admin@bluegrid.cl
--   password: BGCwc5NLVULdnmItX7
--
-- Notas de compatibilidad:
--   - El frontend llama al identificador como "username".
--   - El backend mapea ese "username" a usuarios.correo.
--   - No se crea columna usuarios.username; la fuente real es correo.
--   - El script es idempotente: se puede ejecutar varias veces.
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

-- Compatibilidad si la tabla venia de un estado incompleto.
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
-- 3. OCR Y VALIDACION
-- ============================================================================

CREATE TABLE IF NOT EXISTS registros_ocr (
    id_registro          SERIAL PRIMARY KEY,
    fk_usuario_creador   INTEGER NOT NULL REFERENCES usuarios(id_usuario),
    fk_sector            INTEGER REFERENCES sectores(id_sector) ON DELETE SET NULL,
    fecha_carga          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    url_imagen_original  TEXT NOT NULL,
    url_imagen_procesada TEXT,
    estado_validacion    TEXT DEFAULT 'BORRADOR',
    alerta_confianza     INTEGER DEFAULT 0,
    promedio_confianza   NUMERIC(5,4),
    rechazo_motivo       TEXT,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at         TIMESTAMP,
    validated_by         INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS fk_usuario_creador INTEGER REFERENCES usuarios(id_usuario);
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS fk_sector INTEGER REFERENCES sectores(id_sector) ON DELETE SET NULL;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS fecha_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS url_imagen_original TEXT;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS url_imagen_procesada TEXT;
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
    id_feedback     SERIAL PRIMARY KEY,
    fk_usuario      INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    fk_sector       INTEGER REFERENCES sectores(id_sector) ON DELETE SET NULL,
    fk_registro     INTEGER REFERENCES registros_ocr(id_registro) ON DELETE SET NULL,
    valor_original  TEXT,
    valor_corregido TEXT,
    recorte_base64  TEXT,
    fecha_feedback  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. AUDITORIA
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
-- 5. CONSTRAINTS IDEMPOTENTES
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

-- ============================================================================
-- 6. INDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_usuarios_rut ON usuarios(rut);
CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo);
CREATE INDEX IF NOT EXISTS idx_usuarios_fk_rol ON usuarios(fk_rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_fk_embarcacion ON usuarios(fk_embarcacion);

CREATE INDEX IF NOT EXISTS idx_registros_ocr_fk_usuario_creador ON registros_ocr(fk_usuario_creador);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_validated_by ON registros_ocr(validated_by);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_estado_validacion ON registros_ocr(estado_validacion);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_fecha_carga ON registros_ocr(fecha_carga);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_fk_sector ON registros_ocr(fk_sector);

CREATE INDEX IF NOT EXISTS idx_detalles_captura_fk_registro ON detalles_captura(fk_registro);
CREATE INDEX IF NOT EXISTS idx_detalles_captura_editado_por ON detalles_captura(editado_por);

CREATE INDEX IF NOT EXISTS idx_feedback_ia_fk_usuario ON feedback_ia(fk_usuario);
CREATE INDEX IF NOT EXISTS idx_feedback_ia_fk_sector ON feedback_ia(fk_sector);
CREATE INDEX IF NOT EXISTS idx_feedback_ia_fk_registro ON feedback_ia(fk_registro);

CREATE INDEX IF NOT EXISTS idx_auditoria_fk_usuario ON auditoria_eventos(fk_usuario);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria_eventos(accion);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON auditoria_eventos(created_at);

-- ============================================================================
-- 7. INSERTS BASE
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
-- 8. USUARIOS INICIALES
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
    crypt('BGCwc5NLVULdnmItX7', gen_salt('bf', 12)),
    (SELECT id_rol FROM roles WHERE nombre_rol = 'admin'),
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '22.222.222-2',
    'Supervisor Demo',
    'supervisor@bluegrid.cl',
    crypt('supervisor1234', gen_salt('bf', 12)),
    (SELECT id_rol FROM roles WHERE nombre_rol = 'supervisor'),
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '33.333.333-3',
    'Buzo Demo',
    'buzo@bluegrid.cl',
    crypt('buzo1234', gen_salt('bf', 12)),
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
-- 9. DATOS DEMO MINIMOS PARA DASHBOARD / REPORTES
-- ============================================================================

WITH admin_user AS (
    SELECT id_usuario FROM usuarios WHERE correo = 'admin@bluegrid.cl'
),
melinka AS (
    SELECT id_sector FROM sectores WHERE nombre_sector = 'Melinka' LIMIT 1
),
inserted AS (
    INSERT INTO registros_ocr (
        fk_usuario_creador,
        fk_sector,
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
        CURRENT_TIMESTAMP,
        'seed://bluegrid/demo-original.jpg',
        'seed://bluegrid/demo-procesada.jpg',
        'VALIDADO',
        0,
        0.9700,
        CURRENT_TIMESTAMP
    FROM admin_user, melinka
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
-- SELECT id_usuario, rut, correo, nombre_completo, activo FROM usuarios ORDER BY id_usuario;
-- SELECT COUNT(*) AS registros FROM registros_ocr;
