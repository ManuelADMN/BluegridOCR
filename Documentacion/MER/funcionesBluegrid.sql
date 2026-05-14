-- ============================================================================
-- BLUEGRIDOCR - FUNCIONES, TRIGGERS, AUDITORÍA Y SEGURIDAD
-- PostgreSQL / Supabase
-- ============================================================================
-- Archivo: funcionesBluegrid.sql
--
-- Contenido:
--   - Schema security.
--   - Tabla central de auditoría.
--   - Funciones de contexto de aplicación.
--   - Enmascaramiento de datos sensibles.
--   - Auditoría con hash encadenado.
--   - Triggers genéricos de auditoría.
--   - Triggers updated_at.
--   - Bloqueo de DELETE físico en tablas críticas.
--   - Guards para usuarios y validación OCR.
--   - Eventos manuales de seguridad.
--   - Vistas ejecutivas de auditoría.
--   - Diagnóstico y pruebas controladas.
--
-- Nota:
--   En PostgreSQL/Supabase se usa PL/pgSQL, no PL/SQL Oracle.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. EXTENSIONES Y SEARCH_PATH
-- ============================================================================
-- pgcrypto permite gen_random_uuid(), digest(), crypt(), etc.
-- En Supabase suele estar instalado en el schema "extensions".
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS security;

SET search_path TO public, extensions, security;


-- ============================================================================
-- 1. TABLA CENTRAL DE AUDITORÍA DETALLADA
-- ============================================================================
-- Registra INSERT, UPDATE, DELETE y eventos manuales de seguridad.
-- ============================================================================

CREATE TABLE IF NOT EXISTS security.audit_eventos_detallados (
    id_evento           BIGSERIAL PRIMARY KEY,
    id_evento_uuid      UUID NOT NULL DEFAULT gen_random_uuid(),

    event_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    txid                BIGINT NOT NULL DEFAULT txid_current(),

    schema_name         TEXT NOT NULL,
    table_name          TEXT NOT NULL,
    operation           TEXT NOT NULL CHECK (
        operation IN ('INSERT', 'UPDATE', 'DELETE', 'SECURITY_EVENT')
    ),

    record_pk           JSONB,
    changed_fields      JSONB,
    old_data            JSONB,
    new_data            JSONB,

    actor_user_id       INTEGER,
    actor_email         TEXT,
    actor_role          TEXT,

    client_ip           INET DEFAULT inet_client_addr(),
    request_id          TEXT,
    app_source          TEXT,

    severity            TEXT NOT NULL DEFAULT 'INFO'
                        CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),

    reason              TEXT,

    prev_hash           TEXT,
    row_hash            TEXT NOT NULL,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE security.audit_eventos_detallados IS
'Auditoría detallada de cambios de datos, con contexto de aplicación y hash encadenado.';

COMMENT ON COLUMN security.audit_eventos_detallados.row_hash IS
'Hash SHA-256 del evento actual concatenado con el hash anterior. Permite evidenciar alteraciones.';

COMMENT ON COLUMN security.audit_eventos_detallados.changed_fields IS
'Campos modificados en UPDATE, incluyendo valor anterior y nuevo, con datos sensibles enmascarados.';


-- ============================================================================
-- 2. ÍNDICES DE AUDITORÍA
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_eventos_table
ON security.audit_eventos_detallados(schema_name, table_name);

CREATE INDEX IF NOT EXISTS idx_audit_eventos_operation
ON security.audit_eventos_detallados(operation);

CREATE INDEX IF NOT EXISTS idx_audit_eventos_actor
ON security.audit_eventos_detallados(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_eventos_at
ON security.audit_eventos_detallados(event_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_eventos_request
ON security.audit_eventos_detallados(request_id);

CREATE INDEX IF NOT EXISTS idx_audit_eventos_severity
ON security.audit_eventos_detallados(severity);

CREATE INDEX IF NOT EXISTS idx_audit_eventos_record_pk
ON security.audit_eventos_detallados USING GIN(record_pk);

CREATE INDEX IF NOT EXISTS idx_audit_eventos_changed_fields
ON security.audit_eventos_detallados USING GIN(changed_fields);


-- ============================================================================
-- 3. FUNCIONES DE CONTEXTO DE APLICACIÓN
-- ============================================================================
-- FastAPI debería setear este contexto al inicio de cada request:
--
-- SELECT security.set_audit_context(
--     p_user_id    := 1,
--     p_email      := 'admin@bluegrid.cl',
--     p_role       := 'admin',
--     p_request_id := 'uuid-del-request',
--     p_source     := 'FastAPI'
-- );
-- ============================================================================

CREATE OR REPLACE FUNCTION security.current_app_text(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v TEXT;
BEGIN
    v := NULLIF(current_setting(p_key, true), '');
    RETURN v;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION security.current_app_text(TEXT) IS
'Obtiene de forma segura una variable de sesión de la aplicación.';


CREATE OR REPLACE FUNCTION security.current_app_user_id()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v TEXT;
BEGIN
    v := NULLIF(current_setting('app.user_id', true), '');

    IF v IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN v::INTEGER;

EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION security.current_app_user_id() IS
'Obtiene el ID del usuario de aplicación desde app.user_id.';


CREATE OR REPLACE FUNCTION security.set_audit_context(
    p_user_id    INTEGER,
    p_email      TEXT,
    p_role       TEXT,
    p_request_id TEXT,
    p_source     TEXT DEFAULT 'FastAPI'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.user_id',    COALESCE(p_user_id::TEXT, ''), true);
    PERFORM set_config('app.email',      COALESCE(p_email, ''), true);
    PERFORM set_config('app.role',       COALESCE(p_role, ''), true);
    PERFORM set_config('app.request_id', COALESCE(p_request_id, ''), true);
    PERFORM set_config('app.source',     COALESCE(p_source, 'FastAPI'), true);
END;
$$;

COMMENT ON FUNCTION security.set_audit_context(INTEGER, TEXT, TEXT, TEXT, TEXT) IS
'Setea el contexto de auditoría para asociar cambios SQL a un usuario real de la aplicación.';


-- ============================================================================
-- 4. ENMASCARAMIENTO DE DATOS SENSIBLES
-- ============================================================================

CREATE OR REPLACE FUNCTION security.mask_sensitive(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_out JSONB := COALESCE(p_data, '{}'::JSONB);
    v_key TEXT;
    v_sensitive_keys TEXT[] := ARRAY[
        'password_hash',
        'password',
        'token',
        'access_token',
        'refresh_token',
        'api_key',
        'anthropic_api_key',
        'jwt',
        'secret',
        'recorte_base64',
        'azure_blob_metadata'
    ];
BEGIN
    FOREACH v_key IN ARRAY v_sensitive_keys LOOP
        IF v_out ? v_key THEN
            v_out := jsonb_set(v_out, ARRAY[v_key], to_jsonb('[MASKED]'::TEXT), true);
        END IF;
    END LOOP;

    RETURN v_out;
END;
$$;

COMMENT ON FUNCTION security.mask_sensitive(JSONB) IS
'Enmascara campos sensibles antes de escribirlos en auditoría.';


-- ============================================================================
-- 5. DETECCIÓN DE CAMPOS MODIFICADOS
-- ============================================================================

CREATE OR REPLACE FUNCTION security.jsonb_changed_fields(
    p_old JSONB,
    p_new JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_key TEXT;
    v_result JSONB := '{}'::JSONB;
    v_old JSONB := COALESCE(p_old, '{}'::JSONB);
    v_new JSONB := COALESCE(p_new, '{}'::JSONB);
BEGIN
    FOR v_key IN
        SELECT DISTINCT key_name
        FROM (
            SELECT jsonb_object_keys(v_old) AS key_name
            UNION
            SELECT jsonb_object_keys(v_new) AS key_name
        ) s
    LOOP
        IF (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
            v_result := v_result || jsonb_build_object(
                v_key,
                jsonb_build_object(
                    'old', v_old -> v_key,
                    'new', v_new -> v_key
                )
            );
        END IF;
    END LOOP;

    RETURN security.mask_sensitive(v_result);
END;
$$;

COMMENT ON FUNCTION security.jsonb_changed_fields(JSONB, JSONB) IS
'Devuelve un JSONB con los campos modificados entre OLD y NEW.';


-- ============================================================================
-- 6. EXTRACCIÓN DE PRIMARY KEY O CLAVE LÓGICA
-- ============================================================================

CREATE OR REPLACE FUNCTION security.extract_pk(
    p_row JSONB,
    p_pk_cols TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_col TEXT;
    v_result JSONB := '{}'::JSONB;
BEGIN
    IF p_row IS NULL OR p_pk_cols IS NULL OR trim(p_pk_cols) = '' THEN
        RETURN NULL;
    END IF;

    FOREACH v_col IN ARRAY string_to_array(p_pk_cols, ',') LOOP
        v_col := trim(v_col);
        v_result := v_result || jsonb_build_object(v_col, p_row -> v_col);
    END LOOP;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION security.extract_pk(JSONB, TEXT) IS
'Extrae la clave primaria o lógica de una fila en formato JSONB.';


-- ============================================================================
-- 7. FUNCIÓN CENTRAL DE AUDITORÍA CON HASH ENCADENADO
-- ============================================================================
-- Corrección Supabase:
--   SET search_path = security, public, extensions
--   digest(...::TEXT, 'sha256'::TEXT)
-- ============================================================================

CREATE OR REPLACE FUNCTION security.write_audit_event(
    p_schema_name    TEXT,
    p_table_name     TEXT,
    p_operation      TEXT,
    p_record_pk      JSONB,
    p_old_data       JSONB DEFAULT NULL,
    p_new_data       JSONB DEFAULT NULL,
    p_changed_fields JSONB DEFAULT NULL,
    p_severity       TEXT DEFAULT 'INFO',
    p_reason         TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, extensions
AS $$
DECLARE
    v_event_id BIGINT;
    v_prev_hash TEXT;
    v_row_hash TEXT;
    v_payload JSONB;
    v_old_masked JSONB;
    v_new_masked JSONB;
    v_changed_masked JSONB;
BEGIN
    PERFORM pg_advisory_xact_lock(987654321);

    SELECT row_hash
    INTO v_prev_hash
    FROM security.audit_eventos_detallados
    ORDER BY id_evento DESC
    LIMIT 1;

    v_old_masked := security.mask_sensitive(p_old_data);
    v_new_masked := security.mask_sensitive(p_new_data);
    v_changed_masked := security.mask_sensitive(p_changed_fields);

    v_payload := jsonb_build_object(
        'schema_name', p_schema_name,
        'table_name', p_table_name,
        'operation', p_operation,
        'record_pk', p_record_pk,
        'changed_fields', v_changed_masked,
        'old_data', v_old_masked,
        'new_data', v_new_masked,
        'actor_user_id', security.current_app_user_id(),
        'actor_email', security.current_app_text('app.email'),
        'actor_role', security.current_app_text('app.role'),
        'client_ip', inet_client_addr()::TEXT,
        'request_id', security.current_app_text('app.request_id'),
        'app_source', security.current_app_text('app.source'),
        'severity', COALESCE(p_severity, 'INFO'),
        'reason', p_reason,
        'prev_hash', v_prev_hash,
        'txid', txid_current()
    );

    v_row_hash := encode(
        digest(
            (COALESCE(v_prev_hash, '') || v_payload::TEXT)::TEXT,
            'sha256'::TEXT
        ),
        'hex'
    );

    INSERT INTO security.audit_eventos_detallados (
        schema_name,
        table_name,
        operation,
        record_pk,
        changed_fields,
        old_data,
        new_data,
        actor_user_id,
        actor_email,
        actor_role,
        client_ip,
        request_id,
        app_source,
        severity,
        reason,
        prev_hash,
        row_hash
    )
    VALUES (
        p_schema_name,
        p_table_name,
        p_operation,
        p_record_pk,
        v_changed_masked,
        v_old_masked,
        v_new_masked,
        security.current_app_user_id(),
        security.current_app_text('app.email'),
        security.current_app_text('app.role'),
        inet_client_addr(),
        security.current_app_text('app.request_id'),
        COALESCE(security.current_app_text('app.source'), 'unknown'),
        COALESCE(p_severity, 'INFO'),
        p_reason,
        v_prev_hash,
        v_row_hash
    )
    RETURNING id_evento INTO v_event_id;

    RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION security.write_audit_event(TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, TEXT, TEXT) IS
'Inserta eventos de auditoría con hash encadenado y contexto de usuario.';


-- ============================================================================
-- 8. TRIGGER GENÉRICO DE AUDITORÍA
-- ============================================================================

CREATE OR REPLACE FUNCTION security.trg_audit_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, extensions
AS $$
DECLARE
    v_old JSONB;
    v_new JSONB;
    v_pk JSONB;
    v_changed JSONB;
    v_pk_cols TEXT;
    v_severity TEXT := 'INFO';
BEGIN
    v_pk_cols := NULLIF(TG_ARGV[0], '');

    IF TG_OP = 'INSERT' THEN
        v_new := to_jsonb(NEW);
        v_pk := security.extract_pk(v_new, v_pk_cols);

        IF TG_TABLE_NAME IN ('usuarios', 'roles', 'registros_ocr') THEN
            v_severity := 'WARNING';
        END IF;

        PERFORM security.write_audit_event(
            TG_TABLE_SCHEMA,
            TG_TABLE_NAME,
            TG_OP,
            v_pk,
            NULL,
            v_new,
            NULL,
            v_severity,
            'Registro creado'
        );

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_pk := security.extract_pk(v_new, v_pk_cols);
        v_changed := security.jsonb_changed_fields(v_old, v_new);

        IF v_changed = '{}'::JSONB THEN
            RETURN NEW;
        END IF;

        IF TG_TABLE_NAME IN ('usuarios', 'roles') THEN
            v_severity := 'CRITICAL';
        ELSIF TG_TABLE_NAME IN ('registros_ocr', 'detalles_captura', 'feedback_ia') THEN
            v_severity := 'WARNING';
        END IF;

        PERFORM security.write_audit_event(
            TG_TABLE_SCHEMA,
            TG_TABLE_NAME,
            TG_OP,
            v_pk,
            v_old,
            v_new,
            v_changed,
            v_severity,
            'Registro actualizado'
        );

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        v_pk := security.extract_pk(v_old, v_pk_cols);

        PERFORM security.write_audit_event(
            TG_TABLE_SCHEMA,
            TG_TABLE_NAME,
            TG_OP,
            v_pk,
            v_old,
            NULL,
            NULL,
            'CRITICAL',
            'Intento o ejecución de borrado físico'
        );

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION security.trg_audit_row() IS
'Trigger genérico para auditar INSERT, UPDATE y DELETE.';


-- ============================================================================
-- 9. TRIGGER GENÉRICO PARA updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION security.trg_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION security.trg_touch_updated_at() IS
'Actualiza automáticamente la columna updated_at antes de un UPDATE.';


DO $$
DECLARE
    r RECORD;
    v_trigger_name TEXT;
BEGIN
    FOR r IN
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'updated_at'
    LOOP
        v_trigger_name := 'trg_touch_updated_at_' || r.table_name;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = v_trigger_name
              AND tgrelid = format('%I.%I', r.table_schema, r.table_name)::regclass
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I
                 BEFORE UPDATE ON %I.%I
                 FOR EACH ROW
                 EXECUTE FUNCTION security.trg_touch_updated_at()',
                v_trigger_name,
                r.table_schema,
                r.table_name
            );

            RAISE NOTICE 'Trigger updated_at creado en %.%', r.table_schema, r.table_name;
        END IF;
    END LOOP;
END $$;


-- ============================================================================
-- 10. INSTALACIÓN DE TRIGGERS DE AUDITORÍA
-- ============================================================================

DO $$
DECLARE
    r RECORD;
    v_trigger_name TEXT;
    v_table_regclass REGCLASS;
BEGIN
    FOR r IN
        SELECT *
        FROM (
            VALUES
                ('public', 'roles',                              'id_rol'),
                ('public', 'usuarios',                           'id_usuario'),
                ('public', 'sectores',                           'id_sector'),
                ('public', 'embarcaciones',                      'id_embarcacion'),
                ('public', 'embarcacion_sectores',               'fk_embarcacion,fk_sector'),
                ('public', 'registros_ocr',                      'id_registro'),
                ('public', 'detalles_captura',                   'id_detalle'),
                ('public', 'feedback_ia',                        'id_feedback'),
                ('public', 'tablillas',                          'id_tablilla'),
                ('public', 'tablilla_embarcacion_historial',     'id_historial'),
                ('public', 'usuario_asignaciones_operativas',    'id_asignacion'),
                ('public', 'diccionarios_buzo',                  'id_diccionario'),
                ('public', 'diccionario_buzo_items',             'id_item')
        ) AS t(schema_name, table_name, pk_cols)
    LOOP
        v_table_regclass := to_regclass(format('%I.%I', r.schema_name, r.table_name));

        IF v_table_regclass IS NOT NULL THEN
            v_trigger_name := 'trg_audit_' || r.table_name;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_trigger
                WHERE tgname = v_trigger_name
                  AND tgrelid = v_table_regclass
            ) THEN
                EXECUTE format(
                    'CREATE TRIGGER %I
                     AFTER INSERT OR UPDATE OR DELETE ON %I.%I
                     FOR EACH ROW
                     EXECUTE FUNCTION security.trg_audit_row(%L)',
                    v_trigger_name,
                    r.schema_name,
                    r.table_name,
                    r.pk_cols
                );

                RAISE NOTICE 'Trigger de auditoría creado en %.%', r.schema_name, r.table_name;
            END IF;
        ELSE
            RAISE NOTICE 'Tabla %.% no existe; se omite auditoría.', r.schema_name, r.table_name;
        END IF;
    END LOOP;
END $$;


-- ============================================================================
-- 11. BLOQUEO DE DELETE FÍSICO EN TABLAS CRÍTICAS
-- ============================================================================

CREATE OR REPLACE FUNCTION security.trg_prevent_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, extensions
AS $$
BEGIN
    PERFORM security.write_audit_event(
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        'DELETE',
        to_jsonb(OLD),
        to_jsonb(OLD),
        NULL,
        NULL,
        'CRITICAL',
        'Borrado físico bloqueado. Use baja lógica mediante estado/activo.'
    );

    RAISE EXCEPTION
        'Borrado físico bloqueado en %.%. Use baja lógica mediante estado/activo.',
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME;

    RETURN OLD;
END;
$$;

COMMENT ON FUNCTION security.trg_prevent_hard_delete() IS
'Bloquea DELETE físico en tablas críticas y registra evento crítico.';


DO $$
DECLARE
    r RECORD;
    v_trigger_name TEXT;
    v_table_regclass REGCLASS;
BEGIN
    FOR r IN
        SELECT *
        FROM (
            VALUES
                ('public', 'usuarios'),
                ('public', 'roles'),
                ('public', 'registros_ocr'),
                ('public', 'detalles_captura'),
                ('public', 'feedback_ia'),
                ('public', 'tablillas'),
                ('public', 'diccionarios_buzo'),
                ('public', 'diccionario_buzo_items')
        ) AS t(schema_name, table_name)
    LOOP
        v_table_regclass := to_regclass(format('%I.%I', r.schema_name, r.table_name));

        IF v_table_regclass IS NOT NULL THEN
            v_trigger_name := 'trg_prevent_delete_' || r.table_name;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_trigger
                WHERE tgname = v_trigger_name
                  AND tgrelid = v_table_regclass
            ) THEN
                EXECUTE format(
                    'CREATE TRIGGER %I
                     BEFORE DELETE ON %I.%I
                     FOR EACH ROW
                     EXECUTE FUNCTION security.trg_prevent_hard_delete()',
                    v_trigger_name,
                    r.schema_name,
                    r.table_name
                );

                RAISE NOTICE 'Bloqueo DELETE instalado en %.%', r.schema_name, r.table_name;
            END IF;
        ELSE
            RAISE NOTICE 'Tabla %.% no existe; se omite bloqueo DELETE.', r.schema_name, r.table_name;
        END IF;
    END LOOP;
END $$;


-- ============================================================================
-- 12. GUARD DE USUARIOS
-- ============================================================================

CREATE OR REPLACE FUNCTION security.trg_guard_usuarios_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, extensions
AS $$
DECLARE
    v_role TEXT := COALESCE(security.current_app_text('app.role'), '');
BEGIN
    IF TG_OP = 'UPDATE' THEN

        IF OLD.fk_rol IS DISTINCT FROM NEW.fk_rol AND v_role <> 'admin' THEN
            RAISE EXCEPTION 'Solo admin puede cambiar el rol de un usuario.';
        END IF;

        IF OLD.activo IS DISTINCT FROM NEW.activo AND v_role <> 'admin' THEN
            RAISE EXCEPTION 'Solo admin puede activar o desactivar usuarios.';
        END IF;

        IF OLD.password_hash IS DISTINCT FROM NEW.password_hash
           AND v_role NOT IN ('admin', 'self_password_reset') THEN
            RAISE EXCEPTION 'Cambio de password_hash no autorizado.';
        END IF;

    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION security.trg_guard_usuarios_update() IS
'Controla cambios sensibles en usuarios: rol, activo y password_hash.';


DO $$
BEGIN
    IF to_regclass('public.usuarios') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'trg_guard_usuarios_update'
              AND tgrelid = 'public.usuarios'::regclass
        ) THEN
            CREATE TRIGGER trg_guard_usuarios_update
            BEFORE UPDATE ON public.usuarios
            FOR EACH ROW
            EXECUTE FUNCTION security.trg_guard_usuarios_update();

            RAISE NOTICE 'Protección de usuarios instalada.';
        END IF;
    ELSE
        RAISE NOTICE 'Tabla public.usuarios no existe; se omite protección de usuarios.';
    END IF;
END $$;


-- ============================================================================
-- 13. GUARD DE VALIDACIÓN OCR
-- ============================================================================

CREATE OR REPLACE FUNCTION security.trg_guard_registros_ocr_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, extensions
AS $$
DECLARE
    v_role TEXT := COALESCE(security.current_app_text('app.role'), '');
BEGIN
    IF TG_OP = 'UPDATE' THEN

        IF OLD.estado_validacion IS DISTINCT FROM NEW.estado_validacion
           AND v_role NOT IN ('admin', 'supervisor') THEN
            RAISE EXCEPTION 'Solo admin o supervisor pueden cambiar estado_validacion.';
        END IF;

        IF OLD.estado_validacion = 'VALIDADO'
           AND NEW.estado_validacion IS DISTINCT FROM OLD.estado_validacion
           AND v_role <> 'admin' THEN
            RAISE EXCEPTION 'Solo admin puede modificar un registro OCR ya validado.';
        END IF;

        IF OLD.validated_by IS DISTINCT FROM NEW.validated_by
           AND v_role NOT IN ('admin', 'supervisor') THEN
            RAISE EXCEPTION 'Solo admin o supervisor pueden modificar validated_by.';
        END IF;

    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION security.trg_guard_registros_ocr_validation() IS
'Protege cambios de validación sobre registros OCR.';


DO $$
BEGIN
    IF to_regclass('public.registros_ocr') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'trg_guard_registros_ocr_validation'
              AND tgrelid = 'public.registros_ocr'::regclass
        ) THEN
            CREATE TRIGGER trg_guard_registros_ocr_validation
            BEFORE UPDATE ON public.registros_ocr
            FOR EACH ROW
            EXECUTE FUNCTION security.trg_guard_registros_ocr_validation();

            RAISE NOTICE 'Protección de validación OCR instalada.';
        END IF;
    ELSE
        RAISE NOTICE 'Tabla public.registros_ocr no existe; se omite protección OCR.';
    END IF;
END $$;


-- ============================================================================
-- 14. EVENTOS MANUALES DE SEGURIDAD
-- ============================================================================

CREATE OR REPLACE FUNCTION security.log_security_event(
    p_event_name TEXT,
    p_severity   TEXT DEFAULT 'INFO',
    p_reason     TEXT DEFAULT NULL,
    p_metadata   JSONB DEFAULT '{}'::JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, extensions
AS $$
DECLARE
    v_id BIGINT;
BEGIN
    v_id := security.write_audit_event(
        'security',
        p_event_name,
        'SECURITY_EVENT',
        p_metadata,
        NULL,
        p_metadata,
        NULL,
        p_severity,
        p_reason
    );

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION security.log_security_event(TEXT, TEXT, TEXT, JSONB) IS
'Registra eventos manuales de seguridad desde backend o SQL.';


-- ============================================================================
-- 15. VISTAS DE AUDITORÍA
-- ============================================================================

CREATE OR REPLACE VIEW security.vw_auditoria_resumen AS
SELECT
    id_evento,
    event_at,
    schema_name,
    table_name,
    operation,
    severity,
    actor_user_id,
    actor_email,
    actor_role,
    client_ip,
    request_id,
    app_source,
    record_pk,
    reason
FROM security.audit_eventos_detallados
ORDER BY event_at DESC;

COMMENT ON VIEW security.vw_auditoria_resumen IS
'Vista resumida de eventos de auditoría para revisión administrativa.';


CREATE OR REPLACE VIEW security.vw_auditoria_critica AS
SELECT *
FROM security.audit_eventos_detallados
WHERE severity = 'CRITICAL'
ORDER BY event_at DESC;

COMMENT ON VIEW security.vw_auditoria_critica IS
'Eventos críticos de auditoría: cambios de roles, usuarios, validaciones o borrados.';


-- ============================================================================
-- 16. VERIFICACIÓN DE CADENA HASH
-- ============================================================================

CREATE OR REPLACE FUNCTION security.verify_audit_chain()
RETURNS TABLE (
    id_evento BIGINT,
    valid_chain BOOLEAN,
    stored_prev_hash TEXT,
    expected_prev_hash TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        q.id_evento,
        q.prev_hash IS NOT DISTINCT FROM q.expected_prev_hash AS valid_chain,
        q.prev_hash AS stored_prev_hash,
        q.expected_prev_hash
    FROM (
        SELECT
            a.id_evento,
            a.prev_hash,
            lag(a.row_hash) OVER (ORDER BY a.id_evento) AS expected_prev_hash
        FROM security.audit_eventos_detallados a
    ) q
    ORDER BY q.id_evento;
END;
$$;

COMMENT ON FUNCTION security.verify_audit_chain() IS
'Verifica continuidad de la cadena de hashes de auditoría.';


-- ============================================================================
-- 17. DIAGNÓSTICO DE INTEGRIDAD
-- ============================================================================

DO $$
DECLARE
    v_usuarios_sin_rol INTEGER := 0;
    v_registros_sin_usuario INTEGER := 0;
    v_detalles_huerfanos INTEGER := 0;
    v_feedback_huerfano INTEGER := 0;
BEGIN
    IF to_regclass('public.usuarios') IS NOT NULL THEN
        EXECUTE '
            SELECT COUNT(*)
            FROM public.usuarios
            WHERE fk_rol IS NULL
        ' INTO v_usuarios_sin_rol;

        RAISE NOTICE 'Usuarios sin rol: %', v_usuarios_sin_rol;
    END IF;

    IF to_regclass('public.registros_ocr') IS NOT NULL THEN
        EXECUTE '
            SELECT COUNT(*)
            FROM public.registros_ocr
            WHERE fk_usuario_creador IS NULL
        ' INTO v_registros_sin_usuario;

        RAISE NOTICE 'Registros OCR sin usuario creador: %', v_registros_sin_usuario;
    END IF;

    IF to_regclass('public.detalles_captura') IS NOT NULL
       AND to_regclass('public.registros_ocr') IS NOT NULL THEN
        EXECUTE '
            SELECT COUNT(*)
            FROM public.detalles_captura d
            LEFT JOIN public.registros_ocr r
                   ON r.id_registro = d.fk_registro
            WHERE r.id_registro IS NULL
        ' INTO v_detalles_huerfanos;

        RAISE NOTICE 'Detalles de captura huérfanos: %', v_detalles_huerfanos;
    END IF;

    IF to_regclass('public.feedback_ia') IS NOT NULL
       AND to_regclass('public.registros_ocr') IS NOT NULL THEN
        EXECUTE '
            SELECT COUNT(*)
            FROM public.feedback_ia f
            LEFT JOIN public.registros_ocr r
                   ON r.id_registro = f.fk_registro
            WHERE f.fk_registro IS NOT NULL
              AND r.id_registro IS NULL
        ' INTO v_feedback_huerfano;

        RAISE NOTICE 'Feedback IA huérfano: %', v_feedback_huerfano;
    END IF;
END $$;


-- ============================================================================
-- 18. REGISTRO DE INSTALACIÓN
-- ============================================================================

DO $$
BEGIN
    PERFORM security.set_audit_context(
        NULL,
        'system@bluegrid.local',
        'system',
        gen_random_uuid()::TEXT,
        'SQL_MIGRATION'
    );

    PERFORM security.log_security_event(
        'security_layer_installed',
        'INFO',
        'Instalación o actualización de capa de auditoría y seguridad.',
        jsonb_build_object(
            'module', 'BluegridOCR',
            'features', jsonb_build_array(
                'audit_triggers',
                'hash_chain',
                'sensitive_masking',
                'hard_delete_block',
                'validation_guards',
                'updated_at_triggers'
            )
        )
    );
END $$;

COMMIT;


-- ============================================================================
-- 19. PRUEBAS CONTROLADAS POST-INSTALACIÓN
-- ============================================================================
-- Ejecutar manualmente si se desea comprobar que la auditoría está funcionando.
-- ============================================================================

BEGIN;

SELECT security.set_audit_context(
    p_user_id    := NULL,
    p_email      := 'system@bluegrid.local',
    p_role       := 'system',
    p_request_id := gen_random_uuid()::TEXT,
    p_source     := 'SQL_TEST'
);

SELECT security.log_security_event(
    p_event_name := 'manual_audit_test',
    p_severity   := 'INFO',
    p_reason     := 'Prueba manual de auditoría desde SQL.',
    p_metadata   := jsonb_build_object(
        'test', true,
        'executed_by', 'migration_check',
        'expected_result', 'audit_event_created'
    )
);

COMMIT;


-- ============================================================================
-- 20. CONSULTAS DE VERIFICACIÓN
-- ============================================================================

SELECT
    id_evento,
    event_at,
    schema_name,
    table_name,
    operation,
    severity,
    actor_email,
    actor_role,
    reason,
    row_hash
FROM security.audit_eventos_detallados
ORDER BY id_evento DESC
LIMIT 20;

SELECT *
FROM security.vw_auditoria_resumen
LIMIT 50;

SELECT *
FROM security.vw_auditoria_critica
LIMIT 50;

SELECT *
FROM security.verify_audit_chain()
WHERE valid_chain IS FALSE;
