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
-- BLUEGRIDOCR - EXTENSION TABLILLAS, EMBARCACIONES Y DICCIONARIO BUZO/CLAUDE
-- ============================================================================
-- Objetivo:
--   - Relacionar la tablilla detectada por Claude Vision con una embarcacion.
--   - Permitir que un buzo cambie de embarcacion y de tablilla manteniendo historial.
--   - Guardar contexto/diccionario por buzo y por celda/ref_id para entregarlo a Claude.
--   - Preparar referencias futuras a Azure Blob Storage sin implementar Azure aun.
--   - No modifica datos existentes; solo agrega tablas, columnas, constraints e indices.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLILLAS / TABLAS FISICAS DETECTADAS POR CLAUDE
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

-- Historial de asignacion de tablillas a embarcaciones.
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

-- ============================================================================
-- 2. ASIGNACION ACTUAL E HISTORICA DE BUZOS
-- ============================================================================

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

-- Snapshot operacional en cada OCR: queda guardado con que barco/tablilla se proceso.
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS fk_embarcacion INTEGER REFERENCES embarcaciones(id_embarcacion) ON DELETE SET NULL;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS fk_tablilla INTEGER REFERENCES tablillas(id_tablilla) ON DELETE SET NULL;
ALTER TABLE registros_ocr ADD COLUMN IF NOT EXISTS tablilla_codigo_detectado TEXT;

-- ============================================================================
-- 3. DICCIONARIO DE DATOS DEL BUZO PARA CONTEXTO CLAUDE
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

    -- Ref usado por Claude y el frontend: F1C1, F1C2, F2C3, etc.
    ref_id               TEXT NOT NULL,
    fila_index           INTEGER,
    columna_index        INTEGER,

    valor_original       TEXT,
    valor_corregido      TEXT,
    etiqueta_contexto    TEXT,
    notas                TEXT,

    -- Orden/prioridad para entregar contexto a Claude.
    -- Ej: 1, 2, 3... segun relevancia del buzo/celda.
    prioridad_contexto   INTEGER DEFAULT 1,

    -- Compatibilidad actual: hoy se guarda base64 en feedback_ia.
    recorte_base64       TEXT,

    -- Preparado para Azure Blob Storage futuro.
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

-- Relacion opcional desde feedback actual hacia el nuevo diccionario.
ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS ref_id TEXT;
ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS fk_diccionario_item INTEGER REFERENCES diccionario_buzo_items(id_item) ON DELETE SET NULL;

-- Preparacion Blob tambien en feedback historico, sin borrar recorte_base64 actual.
ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS azure_blob_container TEXT;
ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS azure_blob_path TEXT;
ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS azure_blob_url TEXT;
ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS azure_blob_etag TEXT;
ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS azure_blob_metadata JSONB;

-- ============================================================================
-- 4. CONSTRAINTS IDEMPOTENTES
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_tablilla_codigo') THEN
        ALTER TABLE tablillas ADD CONSTRAINT uk_tablilla_codigo UNIQUE (codigo_tablilla);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tablilla_estado') THEN
        ALTER TABLE tablillas ADD CONSTRAINT chk_tablilla_estado CHECK (
            estado IN ('ACTIVA', 'INACTIVA', 'MANTENCION', 'BAJA')
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_diccionario_buzo_estado') THEN
        ALTER TABLE diccionarios_buzo ADD CONSTRAINT chk_diccionario_buzo_estado CHECK (
            estado IN ('ACTIVO', 'INACTIVO', 'ARCHIVADO')
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_diccionario_item_ref') THEN
        ALTER TABLE diccionario_buzo_items ADD CONSTRAINT uk_diccionario_item_ref UNIQUE (
            fk_diccionario,
            ref_id,
            valor_corregido
        );
    END IF;
END $$;

-- Solo una asignacion activa por buzo.
CREATE UNIQUE INDEX IF NOT EXISTS uk_usuario_asignacion_activa
ON usuario_asignaciones_operativas(fk_usuario)
WHERE activo = TRUE;

-- Solo una relacion activa por tablilla.
CREATE UNIQUE INDEX IF NOT EXISTS uk_tablilla_embarcacion_activa
ON tablilla_embarcacion_historial(fk_tablilla)
WHERE activo = TRUE;

-- ============================================================================
-- 5. INDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tablillas_codigo ON tablillas(codigo_tablilla);
CREATE INDEX IF NOT EXISTS idx_tablillas_fk_embarcacion ON tablillas(fk_embarcacion);
CREATE INDEX IF NOT EXISTS idx_tablillas_estado ON tablillas(estado);

CREATE INDEX IF NOT EXISTS idx_tablilla_embarcacion_historial_tablilla
ON tablilla_embarcacion_historial(fk_tablilla);

CREATE INDEX IF NOT EXISTS idx_tablilla_embarcacion_historial_embarcacion
ON tablilla_embarcacion_historial(fk_embarcacion);

CREATE INDEX IF NOT EXISTS idx_usuarios_fk_tablilla ON usuarios(fk_tablilla);

CREATE INDEX IF NOT EXISTS idx_usuario_asignaciones_usuario
ON usuario_asignaciones_operativas(fk_usuario);

CREATE INDEX IF NOT EXISTS idx_usuario_asignaciones_embarcacion
ON usuario_asignaciones_operativas(fk_embarcacion);

CREATE INDEX IF NOT EXISTS idx_usuario_asignaciones_tablilla
ON usuario_asignaciones_operativas(fk_tablilla);

CREATE INDEX IF NOT EXISTS idx_registros_ocr_fk_embarcacion ON registros_ocr(fk_embarcacion);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_fk_tablilla ON registros_ocr(fk_tablilla);
CREATE INDEX IF NOT EXISTS idx_registros_ocr_tablilla_codigo_detectado ON registros_ocr(tablilla_codigo_detectado);

CREATE INDEX IF NOT EXISTS idx_diccionarios_buzo_usuario
ON diccionarios_buzo(fk_usuario);

CREATE INDEX IF NOT EXISTS idx_diccionarios_buzo_tablilla
ON diccionarios_buzo(fk_tablilla);

CREATE INDEX IF NOT EXISTS idx_diccionario_buzo_items_diccionario
ON diccionario_buzo_items(fk_diccionario);

CREATE INDEX IF NOT EXISTS idx_diccionario_buzo_items_ref
ON diccionario_buzo_items(ref_id);

CREATE INDEX IF NOT EXISTS idx_diccionario_buzo_items_prioridad
ON diccionario_buzo_items(fk_diccionario, prioridad_contexto);

CREATE INDEX IF NOT EXISTS idx_diccionario_buzo_items_blob
ON diccionario_buzo_items(azure_blob_container, azure_blob_path);

CREATE INDEX IF NOT EXISTS idx_feedback_ia_usuario_ref
ON feedback_ia(fk_usuario, ref_id);

CREATE INDEX IF NOT EXISTS idx_feedback_ia_diccionario_item
ON feedback_ia(fk_diccionario_item);

CREATE INDEX IF NOT EXISTS idx_feedback_ia_blob
ON feedback_ia(azure_blob_container, azure_blob_path);

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
