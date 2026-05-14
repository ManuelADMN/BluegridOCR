-- ============================================================================
-- BLUEGRIDOCR - CAPA DE VISTAS PROFESIONALES
-- PostgreSQL / Supabase
-- ============================================================================
-- Archivo: vistasBluegrid.sql
--
-- Objetivo:
--   - Crear vistas limpias para dashboard, reportes, validación y trazabilidad.
--   - Evitar joins repetidos desde FastAPI.
--   - Exponer datos operativos sin password_hash ni campos sensibles.
--   - Facilitar consumo desde frontend, Supabase, FastAPI o BI.
--
-- Basado en las tablas existentes del esquema BluegridOCR:
-- usuarios, roles, sectores, embarcaciones, registros_ocr, detalles_captura,
-- feedback_ia, tablillas, diccionarios_buzo y asignaciones operativas.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. SCHEMA DE REPORTING
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS reporting;


-- ============================================================================
-- 1. VISTA: USUARIOS OPERATIVOS
-- ============================================================================
-- Lista usuarios sin exponer password_hash.
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_usuarios_operativos AS
SELECT
    u.id_usuario,
    u.rut,
    u.nombre_completo,
    u.correo,
    u.activo,
    u.created_at,
    u.updated_at,

    r.id_rol,
    r.nombre_rol,
    r.descripcion AS descripcion_rol,

    e.id_embarcacion,
    e.matricula AS embarcacion_matricula,
    e.nombre_nave AS embarcacion_nombre,
    e.estado AS embarcacion_estado,

    t.id_tablilla,
    t.codigo_tablilla,
    t.nombre_referencia AS tablilla_nombre,
    t.estado AS tablilla_estado

FROM public.usuarios u
LEFT JOIN public.roles r
       ON r.id_rol = u.fk_rol
LEFT JOIN public.embarcaciones e
       ON e.id_embarcacion = u.fk_embarcacion
LEFT JOIN public.tablillas t
       ON t.id_tablilla = u.fk_tablilla;

COMMENT ON VIEW reporting.vw_usuarios_operativos IS
'Usuarios con rol, embarcación y tablilla asignada, sin exponer password_hash.';


-- ============================================================================
-- 2. VISTA: REGISTROS OCR DETALLADOS
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_registros_ocr_detallados AS
SELECT
    r.id_registro,
    r.fecha_carga,
    r.url_imagen_original,
    r.url_imagen_procesada,
    r.estado_validacion,
    r.alerta_confianza,
    r.promedio_confianza,
    r.updated_at,

    r.fk_usuario_creador,
    creador.nombre_completo AS usuario_creador_nombre,
    creador.correo AS usuario_creador_correo,

    rol_creador.nombre_rol AS usuario_creador_rol,

    r.validated_by,
    validador.nombre_completo AS usuario_validador_nombre,
    validador.correo AS usuario_validador_correo,

    s.id_sector,
    s.nombre_sector,
    s.region_chile,

    e.id_embarcacion,
    e.matricula AS embarcacion_matricula,
    e.nombre_nave AS embarcacion_nombre,

    t.id_tablilla,
    t.codigo_tablilla,
    t.nombre_referencia AS tablilla_nombre,
    r.tablilla_codigo_detectado,

    CASE
        WHEN r.promedio_confianza IS NULL THEN 'SIN_CONFIANZA'
        WHEN r.promedio_confianza >= 0.90 THEN 'ALTA'
        WHEN r.promedio_confianza >= 0.75 THEN 'MEDIA'
        ELSE 'BAJA'
    END AS nivel_confianza,

    CASE
        WHEN r.estado_validacion = 'VALIDADO' THEN TRUE
        ELSE FALSE
    END AS esta_validado

FROM public.registros_ocr r
LEFT JOIN public.usuarios creador
       ON creador.id_usuario = r.fk_usuario_creador
LEFT JOIN public.roles rol_creador
       ON rol_creador.id_rol = creador.fk_rol
LEFT JOIN public.usuarios validador
       ON validador.id_usuario = r.validated_by
LEFT JOIN public.sectores s
       ON s.id_sector = r.fk_sector
LEFT JOIN public.embarcaciones e
       ON e.id_embarcacion = r.fk_embarcacion
LEFT JOIN public.tablillas t
       ON t.id_tablilla = r.fk_tablilla;

COMMENT ON VIEW reporting.vw_registros_ocr_detallados IS
'Vista detallada de registros OCR con trazabilidad de usuario, sector, embarcación, tablilla y validación.';


-- ============================================================================
-- 3. VISTA: DETALLES DE CAPTURA COMPLETOS
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_detalles_captura_completos AS
SELECT
    d.id_detalle,
    d.fk_registro,
    d.fila_index,
    d.n_nidos,
    d.n_cuevas_cubiertas,
    d.captura_hembras_tipo,
    d.total_pulpos,
    d.datos_editados,
    d.confianza_fila,
    d.updated_at AS detalle_updated_at,

    r.fecha_carga,
    r.estado_validacion,
    r.promedio_confianza AS confianza_registro,
    r.alerta_confianza,

    u.id_usuario AS usuario_creador_id,
    u.nombre_completo AS usuario_creador_nombre,
    u.correo AS usuario_creador_correo,

    s.id_sector,
    s.nombre_sector,
    s.region_chile,

    e.id_embarcacion,
    e.matricula AS embarcacion_matricula,
    e.nombre_nave AS embarcacion_nombre,

    t.id_tablilla,
    t.codigo_tablilla,

    editor.id_usuario AS editado_por_id,
    editor.nombre_completo AS editado_por_nombre,

    CASE
        WHEN d.datos_editados = 1 THEN TRUE
        ELSE FALSE
    END AS fue_editado,

    CASE
        WHEN d.confianza_fila IS NULL THEN 'SIN_CONFIANZA'
        WHEN d.confianza_fila >= 0.90 THEN 'ALTA'
        WHEN d.confianza_fila >= 0.75 THEN 'MEDIA'
        ELSE 'BAJA'
    END AS nivel_confianza_fila

FROM public.detalles_captura d
LEFT JOIN public.registros_ocr r
       ON r.id_registro = d.fk_registro
LEFT JOIN public.usuarios u
       ON u.id_usuario = r.fk_usuario_creador
LEFT JOIN public.sectores s
       ON s.id_sector = r.fk_sector
LEFT JOIN public.embarcaciones e
       ON e.id_embarcacion = r.fk_embarcacion
LEFT JOIN public.tablillas t
       ON t.id_tablilla = r.fk_tablilla
LEFT JOIN public.usuarios editor
       ON editor.id_usuario = d.editado_por;

COMMENT ON VIEW reporting.vw_detalles_captura_completos IS
'Detalles de captura OCR enriquecidos con registro, usuario, sector, embarcación y tablilla.';


-- ============================================================================
-- 4. VISTA: KPI GENERAL DEL SISTEMA
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_kpi_general AS
SELECT
    COUNT(*) AS total_registros_ocr,

    COUNT(*) FILTER (
        WHERE estado_validacion = 'VALIDADO'
    ) AS registros_validados,

    COUNT(*) FILTER (
        WHERE estado_validacion IS DISTINCT FROM 'VALIDADO'
    ) AS registros_no_validados,

    COUNT(*) FILTER (
        WHERE alerta_confianza = 1
    ) AS registros_con_alerta_confianza,

    ROUND(AVG(promedio_confianza)::NUMERIC, 4) AS promedio_confianza_global,

    MIN(fecha_carga) AS primera_fecha_carga,
    MAX(fecha_carga) AS ultima_fecha_carga,

    COUNT(DISTINCT fk_usuario_creador) AS usuarios_con_registros,
    COUNT(DISTINCT fk_sector) AS sectores_con_registros,
    COUNT(DISTINCT fk_embarcacion) AS embarcaciones_con_registros,
    COUNT(DISTINCT fk_tablilla) AS tablillas_con_registros

FROM public.registros_ocr;

COMMENT ON VIEW reporting.vw_kpi_general IS
'KPI global del sistema OCR: registros, validación, confianza y cobertura operacional.';


-- ============================================================================
-- 5. VISTA: DASHBOARD POR SECTOR
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_dashboard_por_sector AS
SELECT
    s.id_sector,
    s.nombre_sector,
    s.region_chile,

    COUNT(r.id_registro) AS total_registros,

    COUNT(r.id_registro) FILTER (
        WHERE r.estado_validacion = 'VALIDADO'
    ) AS registros_validados,

    COUNT(r.id_registro) FILTER (
        WHERE r.estado_validacion IS DISTINCT FROM 'VALIDADO'
    ) AS registros_pendientes_o_no_validados,

    COUNT(r.id_registro) FILTER (
        WHERE r.alerta_confianza = 1
    ) AS registros_con_alerta_confianza,

    ROUND(AVG(r.promedio_confianza)::NUMERIC, 4) AS promedio_confianza,

    COUNT(DISTINCT r.fk_usuario_creador) AS total_usuarios,
    COUNT(DISTINCT r.fk_embarcacion) AS total_embarcaciones,
    COUNT(DISTINCT r.fk_tablilla) AS total_tablillas,

    MIN(r.fecha_carga) AS primera_carga,
    MAX(r.fecha_carga) AS ultima_carga

FROM public.sectores s
LEFT JOIN public.registros_ocr r
       ON r.fk_sector = s.id_sector
GROUP BY
    s.id_sector,
    s.nombre_sector,
    s.region_chile;

COMMENT ON VIEW reporting.vw_dashboard_por_sector IS
'Resumen de registros OCR, validación y confianza agrupado por sector.';


-- ============================================================================
-- 6. VISTA: DASHBOARD POR USUARIO / BUZO
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_dashboard_por_usuario AS
SELECT
    u.id_usuario,
    u.rut,
    u.nombre_completo,
    u.correo,
    u.activo,

    rol.nombre_rol,

    e.id_embarcacion,
    e.matricula AS embarcacion_matricula,
    e.nombre_nave AS embarcacion_nombre,

    t.id_tablilla,
    t.codigo_tablilla,

    COUNT(r.id_registro) AS total_registros,

    COUNT(r.id_registro) FILTER (
        WHERE r.estado_validacion = 'VALIDADO'
    ) AS registros_validados,

    COUNT(r.id_registro) FILTER (
        WHERE r.estado_validacion IS DISTINCT FROM 'VALIDADO'
    ) AS registros_no_validados,

    COUNT(r.id_registro) FILTER (
        WHERE r.alerta_confianza = 1
    ) AS registros_con_alerta_confianza,

    ROUND(AVG(r.promedio_confianza)::NUMERIC, 4) AS promedio_confianza,

    MIN(r.fecha_carga) AS primera_carga,
    MAX(r.fecha_carga) AS ultima_carga,

    COALESCE(SUM(dc.total_pulpos), 0) AS total_pulpos_reportados,
    COALESCE(SUM(dc.n_nidos), 0) AS total_nidos_reportados,
    COALESCE(SUM(dc.n_cuevas_cubiertas), 0) AS total_cuevas_cubiertas_reportadas,

    COUNT(dc.id_detalle) FILTER (
        WHERE dc.datos_editados = 1
    ) AS filas_editadas

FROM public.usuarios u
LEFT JOIN public.roles rol
       ON rol.id_rol = u.fk_rol
LEFT JOIN public.embarcaciones e
       ON e.id_embarcacion = u.fk_embarcacion
LEFT JOIN public.tablillas t
       ON t.id_tablilla = u.fk_tablilla
LEFT JOIN public.registros_ocr r
       ON r.fk_usuario_creador = u.id_usuario
LEFT JOIN public.detalles_captura dc
       ON dc.fk_registro = r.id_registro
GROUP BY
    u.id_usuario,
    u.rut,
    u.nombre_completo,
    u.correo,
    u.activo,
    rol.nombre_rol,
    e.id_embarcacion,
    e.matricula,
    e.nombre_nave,
    t.id_tablilla,
    t.codigo_tablilla;

COMMENT ON VIEW reporting.vw_dashboard_por_usuario IS
'Resumen operativo por usuario/buzo: registros, confianza, validación y capturas agregadas.';


-- ============================================================================
-- 7. VISTA: DASHBOARD POR EMBARCACIÓN
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_dashboard_por_embarcacion AS
SELECT
    e.id_embarcacion,
    e.matricula,
    e.nombre_nave,
    e.capacidad_personas,
    e.estado,

    COUNT(r.id_registro) AS total_registros,

    COUNT(r.id_registro) FILTER (
        WHERE r.estado_validacion = 'VALIDADO'
    ) AS registros_validados,

    COUNT(r.id_registro) FILTER (
        WHERE r.alerta_confianza = 1
    ) AS registros_con_alerta_confianza,

    ROUND(AVG(r.promedio_confianza)::NUMERIC, 4) AS promedio_confianza,

    COUNT(DISTINCT r.fk_usuario_creador) AS usuarios_operando,
    COUNT(DISTINCT r.fk_sector) AS sectores_operados,
    COUNT(DISTINCT r.fk_tablilla) AS tablillas_usadas,

    COALESCE(SUM(dc.total_pulpos), 0) AS total_pulpos,
    COALESCE(SUM(dc.n_nidos), 0) AS total_nidos,
    COALESCE(SUM(dc.n_cuevas_cubiertas), 0) AS total_cuevas_cubiertas,

    MIN(r.fecha_carga) AS primera_carga,
    MAX(r.fecha_carga) AS ultima_carga

FROM public.embarcaciones e
LEFT JOIN public.registros_ocr r
       ON r.fk_embarcacion = e.id_embarcacion
LEFT JOIN public.detalles_captura dc
       ON dc.fk_registro = r.id_registro
GROUP BY
    e.id_embarcacion,
    e.matricula,
    e.nombre_nave,
    e.capacidad_personas,
    e.estado;

COMMENT ON VIEW reporting.vw_dashboard_por_embarcacion IS
'Resumen operativo OCR agrupado por embarcación.';


-- ============================================================================
-- 8. VISTA: DASHBOARD DIARIO
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_dashboard_diario AS
SELECT
    DATE_TRUNC('day', r.fecha_carga)::DATE AS fecha,

    COUNT(r.id_registro) AS total_registros,

    COUNT(r.id_registro) FILTER (
        WHERE r.estado_validacion = 'VALIDADO'
    ) AS registros_validados,

    COUNT(r.id_registro) FILTER (
        WHERE r.estado_validacion IS DISTINCT FROM 'VALIDADO'
    ) AS registros_no_validados,

    COUNT(r.id_registro) FILTER (
        WHERE r.alerta_confianza = 1
    ) AS registros_con_alerta_confianza,

    ROUND(AVG(r.promedio_confianza)::NUMERIC, 4) AS promedio_confianza,

    COUNT(DISTINCT r.fk_usuario_creador) AS usuarios_activos,
    COUNT(DISTINCT r.fk_sector) AS sectores_activos,
    COUNT(DISTINCT r.fk_embarcacion) AS embarcaciones_activas,

    COALESCE(SUM(dc.total_pulpos), 0) AS total_pulpos,
    COALESCE(SUM(dc.n_nidos), 0) AS total_nidos,
    COALESCE(SUM(dc.n_cuevas_cubiertas), 0) AS total_cuevas_cubiertas

FROM public.registros_ocr r
LEFT JOIN public.detalles_captura dc
       ON dc.fk_registro = r.id_registro
GROUP BY
    DATE_TRUNC('day', r.fecha_carga)::DATE
ORDER BY
    fecha DESC;

COMMENT ON VIEW reporting.vw_dashboard_diario IS
'Resumen diario de actividad OCR para gráficos temporales.';


-- ============================================================================
-- 9. VISTA: CALIDAD OCR POR REGISTRO
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_calidad_ocr_por_registro AS
SELECT
    r.id_registro,
    r.fecha_carga,
    r.estado_validacion,
    r.promedio_confianza,
    r.alerta_confianza,

    u.id_usuario AS usuario_creador_id,
    u.nombre_completo AS usuario_creador_nombre,

    s.nombre_sector,
    e.nombre_nave AS embarcacion_nombre,
    t.codigo_tablilla,

    COUNT(dc.id_detalle) AS total_filas_detectadas,

    COUNT(dc.id_detalle) FILTER (
        WHERE dc.datos_editados = 1
    ) AS total_filas_editadas,

    ROUND(AVG(dc.confianza_fila)::NUMERIC, 4) AS promedio_confianza_filas,

    ROUND(
        (
            COUNT(dc.id_detalle) FILTER (WHERE dc.datos_editados = 1)::NUMERIC
            / NULLIF(COUNT(dc.id_detalle), 0)
        ),
        4
    ) AS tasa_edicion_manual,

    CASE
        WHEN r.alerta_confianza = 1 THEN 'REVISAR'
        WHEN AVG(dc.confianza_fila) < 0.75 THEN 'REVISAR'
        WHEN COUNT(dc.id_detalle) FILTER (WHERE dc.datos_editados = 1) > 0 THEN 'REVISADO_CON_EDICIONES'
        ELSE 'OK'
    END AS estado_calidad_ocr

FROM public.registros_ocr r
LEFT JOIN public.detalles_captura dc
       ON dc.fk_registro = r.id_registro
LEFT JOIN public.usuarios u
       ON u.id_usuario = r.fk_usuario_creador
LEFT JOIN public.sectores s
       ON s.id_sector = r.fk_sector
LEFT JOIN public.embarcaciones e
       ON e.id_embarcacion = r.fk_embarcacion
LEFT JOIN public.tablillas t
       ON t.id_tablilla = r.fk_tablilla
GROUP BY
    r.id_registro,
    r.fecha_carga,
    r.estado_validacion,
    r.promedio_confianza,
    r.alerta_confianza,
    u.id_usuario,
    u.nombre_completo,
    s.nombre_sector,
    e.nombre_nave,
    t.codigo_tablilla;

COMMENT ON VIEW reporting.vw_calidad_ocr_por_registro IS
'Indicadores de calidad OCR por registro, incluyendo confianza, edición manual y estado de revisión.';


-- ============================================================================
-- 10. VISTA: BANDEJA DE VALIDACIÓN OCR
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_bandeja_validacion_ocr AS
SELECT
    q.id_registro,
    q.fecha_carga,
    q.estado_validacion,
    q.promedio_confianza,
    q.alerta_confianza,
    q.usuario_creador_nombre,
    q.nombre_sector,
    q.embarcacion_nombre,
    q.codigo_tablilla,
    q.total_filas_detectadas,
    q.total_filas_editadas,
    q.promedio_confianza_filas,
    q.tasa_edicion_manual,
    q.estado_calidad_ocr,

    CASE
        WHEN q.alerta_confianza = 1 THEN 100
        WHEN q.promedio_confianza < 0.75 THEN 90
        WHEN q.total_filas_editadas > 0 THEN 70
        WHEN q.estado_validacion IS DISTINCT FROM 'VALIDADO' THEN 60
        ELSE 10
    END AS prioridad_validacion

FROM reporting.vw_calidad_ocr_por_registro q
WHERE
    q.estado_validacion IS DISTINCT FROM 'VALIDADO'
    OR q.alerta_confianza = 1
    OR q.total_filas_editadas > 0
    OR q.promedio_confianza < 0.75
ORDER BY
    prioridad_validacion DESC,
    fecha_carga DESC;

COMMENT ON VIEW reporting.vw_bandeja_validacion_ocr IS
'Bandeja de registros OCR que requieren validación o revisión priorizada.';


-- ============================================================================
-- 11. VISTA: TABLILLAS OPERATIVAS
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_tablillas_operativas AS
SELECT
    t.id_tablilla,
    t.codigo_tablilla,
    t.nombre_referencia,
    t.descripcion,
    t.estado,
    t.origen,
    t.created_at,
    t.updated_at,

    e.id_embarcacion,
    e.matricula AS embarcacion_matricula,
    e.nombre_nave AS embarcacion_nombre,

    creator.id_usuario AS created_by_id,
    creator.nombre_completo AS created_by_nombre,

    updater.id_usuario AS updated_by_id,
    updater.nombre_completo AS updated_by_nombre,

    COUNT(r.id_registro) AS total_registros_ocr,
    MAX(r.fecha_carga) AS ultima_fecha_uso,

    COUNT(r.id_registro) FILTER (
        WHERE r.estado_validacion = 'VALIDADO'
    ) AS registros_validados,

    ROUND(AVG(r.promedio_confianza)::NUMERIC, 4) AS promedio_confianza

FROM public.tablillas t
LEFT JOIN public.embarcaciones e
       ON e.id_embarcacion = t.fk_embarcacion
LEFT JOIN public.usuarios creator
       ON creator.id_usuario = t.created_by
LEFT JOIN public.usuarios updater
       ON updater.id_usuario = t.updated_by
LEFT JOIN public.registros_ocr r
       ON r.fk_tablilla = t.id_tablilla
GROUP BY
    t.id_tablilla,
    t.codigo_tablilla,
    t.nombre_referencia,
    t.descripcion,
    t.estado,
    t.origen,
    t.created_at,
    t.updated_at,
    e.id_embarcacion,
    e.matricula,
    e.nombre_nave,
    creator.id_usuario,
    creator.nombre_completo,
    updater.id_usuario,
    updater.nombre_completo;

COMMENT ON VIEW reporting.vw_tablillas_operativas IS
'Vista operativa de tablillas con embarcación asociada y actividad OCR.';


-- ============================================================================
-- 12. VISTA: ASIGNACIÓN ACTUAL DE BUZOS
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_asignaciones_actuales_buzo AS
SELECT
    a.id_asignacion,
    a.fecha_inicio,
    a.fecha_fin,
    a.activo,
    a.motivo,
    a.created_at,
    a.updated_at,

    u.id_usuario,
    u.rut,
    u.nombre_completo,
    u.correo,

    rol.nombre_rol,

    e.id_embarcacion,
    e.matricula AS embarcacion_matricula,
    e.nombre_nave AS embarcacion_nombre,

    t.id_tablilla,
    t.codigo_tablilla,
    t.nombre_referencia AS tablilla_nombre,

    asignador.id_usuario AS asignado_por_id,
    asignador.nombre_completo AS asignado_por_nombre

FROM public.usuario_asignaciones_operativas a
LEFT JOIN public.usuarios u
       ON u.id_usuario = a.fk_usuario
LEFT JOIN public.roles rol
       ON rol.id_rol = u.fk_rol
LEFT JOIN public.embarcaciones e
       ON e.id_embarcacion = a.fk_embarcacion
LEFT JOIN public.tablillas t
       ON t.id_tablilla = a.fk_tablilla
LEFT JOIN public.usuarios asignador
       ON asignador.id_usuario = a.asignado_por
WHERE a.activo = TRUE;

COMMENT ON VIEW reporting.vw_asignaciones_actuales_buzo IS
'Asignaciones operativas activas de buzos a embarcación y tablilla.';


-- ============================================================================
-- 13. VISTA: HISTORIAL DE TABLILLAS POR EMBARCACIÓN
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_historial_tablilla_embarcacion AS
SELECT
    h.id_historial,
    h.fecha_inicio,
    h.fecha_fin,
    h.activo,
    h.motivo,
    h.created_at,

    t.id_tablilla,
    t.codigo_tablilla,
    t.nombre_referencia AS tablilla_nombre,

    e.id_embarcacion,
    e.matricula AS embarcacion_matricula,
    e.nombre_nave AS embarcacion_nombre,

    u.id_usuario AS asignado_por_id,
    u.nombre_completo AS asignado_por_nombre,

    CASE
        WHEN h.activo = TRUE THEN 'ASIGNACION_ACTUAL'
        ELSE 'ASIGNACION_HISTORICA'
    END AS tipo_asignacion

FROM public.tablilla_embarcacion_historial h
LEFT JOIN public.tablillas t
       ON t.id_tablilla = h.fk_tablilla
LEFT JOIN public.embarcaciones e
       ON e.id_embarcacion = h.fk_embarcacion
LEFT JOIN public.usuarios u
       ON u.id_usuario = h.asignado_por
ORDER BY
    h.fecha_inicio DESC;

COMMENT ON VIEW reporting.vw_historial_tablilla_embarcacion IS
'Historial de asignación de tablillas a embarcaciones.';


-- ============================================================================
-- 14. VISTA: DICCIONARIO BUZO PARA CONTEXTO IA
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_diccionario_buzo_contexto AS
SELECT
    d.id_diccionario,
    d.nombre_diccionario,
    d.descripcion,
    d.version,
    d.estado,
    d.prioridad_contexto AS prioridad_diccionario,
    d.created_at AS diccionario_created_at,
    d.updated_at AS diccionario_updated_at,

    u.id_usuario,
    u.nombre_completo AS usuario_nombre,
    u.correo AS usuario_correo,

    e.id_embarcacion,
    e.matricula AS embarcacion_matricula,
    e.nombre_nave AS embarcacion_nombre,

    t.id_tablilla,
    t.codigo_tablilla,

    i.id_item,
    i.ref_id,
    i.fila_index,
    i.columna_index,
    i.valor_original,
    i.valor_corregido,
    i.etiqueta_contexto,
    i.notas,
    i.prioridad_contexto AS prioridad_item,
    i.activo AS item_activo,
    i.usos_contexto,
    i.ultimo_uso_at,

    -- No se expone recorte_base64 para evitar payload pesado y sensible.
    i.azure_blob_container,
    i.azure_blob_path,
    i.azure_blob_url,
    i.azure_blob_etag,

    i.created_at AS item_created_at,
    i.updated_at AS item_updated_at

FROM public.diccionarios_buzo d
LEFT JOIN public.usuarios u
       ON u.id_usuario = d.fk_usuario
LEFT JOIN public.embarcaciones e
       ON e.id_embarcacion = d.fk_embarcacion
LEFT JOIN public.tablillas t
       ON t.id_tablilla = d.fk_tablilla
LEFT JOIN public.diccionario_buzo_items i
       ON i.fk_diccionario = d.id_diccionario
WHERE
    d.estado = 'ACTIVO'
    AND COALESCE(i.activo, TRUE) = TRUE
ORDER BY
    d.prioridad_contexto ASC,
    i.prioridad_contexto ASC,
    i.ref_id ASC;

COMMENT ON VIEW reporting.vw_diccionario_buzo_contexto IS
'Vista de contexto OCR por buzo, embarcación, tablilla y celda/ref_id, sin exponer recorte_base64.';


-- ============================================================================
-- 15. VISTA: FEEDBACK IA DETALLADO
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_feedback_ia_detallado AS
SELECT
    f.id_feedback,
    f.fk_usuario,
    u.nombre_completo AS usuario_nombre,
    u.correo AS usuario_correo,

    f.fk_sector,
    s.nombre_sector,
    s.region_chile,

    f.fk_registro,
    r.fecha_carga,
    r.estado_validacion,
    r.promedio_confianza,

    f.ref_id,
    f.fk_diccionario_item,

    i.valor_original AS diccionario_valor_original,
    i.valor_corregido AS diccionario_valor_corregido,
    i.etiqueta_contexto AS diccionario_etiqueta_contexto,

    f.azure_blob_container,
    f.azure_blob_path,
    f.azure_blob_url,
    f.azure_blob_etag,
    f.azure_blob_metadata

FROM public.feedback_ia f
LEFT JOIN public.usuarios u
       ON u.id_usuario = f.fk_usuario
LEFT JOIN public.sectores s
       ON s.id_sector = f.fk_sector
LEFT JOIN public.registros_ocr r
       ON r.id_registro = f.fk_registro
LEFT JOIN public.diccionario_buzo_items i
       ON i.id_item = f.fk_diccionario_item;

COMMENT ON VIEW reporting.vw_feedback_ia_detallado IS
'Feedback IA enriquecido con usuario, sector, registro OCR y diccionario asociado.';


-- ============================================================================
-- 16. VISTA: ALERTAS OPERATIVAS
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_alertas_operativas AS
SELECT
    'OCR_BAJA_CONFIANZA' AS tipo_alerta,
    r.id_registro::TEXT AS entidad_id,
    r.fecha_carga AS fecha_evento,
    'WARNING' AS severidad,
    concat(
        'Registro OCR con confianza baja: ',
        COALESCE(r.promedio_confianza::TEXT, 'NULL')
    ) AS descripcion
FROM public.registros_ocr r
WHERE
    r.alerta_confianza = 1
    OR r.promedio_confianza < 0.75

UNION ALL

SELECT
    'REGISTRO_NO_VALIDADO' AS tipo_alerta,
    r.id_registro::TEXT AS entidad_id,
    r.fecha_carga AS fecha_evento,
    'INFO' AS severidad,
    'Registro OCR pendiente o no validado.' AS descripcion
FROM public.registros_ocr r
WHERE
    r.estado_validacion IS DISTINCT FROM 'VALIDADO'

UNION ALL

SELECT
    'USUARIO_INACTIVO_CON_REGISTROS' AS tipo_alerta,
    u.id_usuario::TEXT AS entidad_id,
    MAX(r.fecha_carga) AS fecha_evento,
    'WARNING' AS severidad,
    'Usuario inactivo posee registros OCR asociados.' AS descripcion
FROM public.usuarios u
JOIN public.registros_ocr r
  ON r.fk_usuario_creador = u.id_usuario
WHERE
    u.activo = FALSE
GROUP BY
    u.id_usuario

UNION ALL

SELECT
    'TABLILLA_INACTIVA_CON_USO' AS tipo_alerta,
    t.id_tablilla::TEXT AS entidad_id,
    MAX(r.fecha_carga) AS fecha_evento,
    'WARNING' AS severidad,
    'Tablilla inactiva registra uso en OCR.' AS descripcion
FROM public.tablillas t
JOIN public.registros_ocr r
  ON r.fk_tablilla = t.id_tablilla
WHERE
    t.estado <> 'ACTIVA'
GROUP BY
    t.id_tablilla;

COMMENT ON VIEW reporting.vw_alertas_operativas IS
'Alertas operativas derivadas de OCR, validación, usuarios y tablillas.';


-- ============================================================================
-- 17. VISTA: EXPORTACIÓN LIMPIA PARA CSV / EXCEL
-- ============================================================================

CREATE OR REPLACE VIEW reporting.vw_export_registros_ocr_excel AS
SELECT
    r.id_registro,
    r.fecha_carga::DATE AS fecha,
    r.fecha_carga::TIME AS hora,

    r.estado_validacion,
    r.promedio_confianza,
    r.alerta_confianza,

    u.nombre_completo AS usuario_creador,
    u.correo AS correo_usuario,

    s.nombre_sector,
    s.region_chile,

    e.matricula AS embarcacion_matricula,
    e.nombre_nave AS embarcacion_nombre,

    t.codigo_tablilla,
    r.tablilla_codigo_detectado,

    d.id_detalle,
    d.fila_index,
    d.n_nidos,
    d.n_cuevas_cubiertas,
    d.captura_hembras_tipo,
    d.total_pulpos,
    d.datos_editados,
    d.confianza_fila,

    CASE
        WHEN d.datos_editados = 1 THEN 'SI'
        ELSE 'NO'
    END AS fila_editada,

    r.url_imagen_original,
    r.url_imagen_procesada

FROM public.registros_ocr r
LEFT JOIN public.detalles_captura d
       ON d.fk_registro = r.id_registro
LEFT JOIN public.usuarios u
       ON u.id_usuario = r.fk_usuario_creador
LEFT JOIN public.sectores s
       ON s.id_sector = r.fk_sector
LEFT JOIN public.embarcaciones e
       ON e.id_embarcacion = r.fk_embarcacion
LEFT JOIN public.tablillas t
       ON t.id_tablilla = r.fk_tablilla
ORDER BY
    r.fecha_carga DESC,
    r.id_registro DESC,
    d.fila_index ASC;

COMMENT ON VIEW reporting.vw_export_registros_ocr_excel IS
'Vista plana para exportación CSV/Excel de registros OCR y detalles capturados.';


-- ============================================================================
-- 18. PERMISOS RECOMENDADOS
-- ============================================================================
-- Supabase normalmente posee authenticated y service_role.
-- Para compatibilidad local, los GRANT se ejecutan solo si el rol existe.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT USAGE ON SCHEMA reporting TO authenticated;
        GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT USAGE ON SCHEMA reporting TO service_role;
        GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO service_role;
    END IF;
END $$;


-- ============================================================================
-- 19. VERIFICACIÓN RÁPIDA
-- ============================================================================

SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema = 'reporting'
ORDER BY table_name;

COMMIT;


-- ============================================================================
-- 20. CONSULTAS DE PRUEBA
-- ============================================================================

SELECT * FROM reporting.vw_kpi_general;

SELECT *
FROM reporting.vw_registros_ocr_detallados
LIMIT 20;

SELECT *
FROM reporting.vw_bandeja_validacion_ocr
LIMIT 20;

SELECT *
FROM reporting.vw_export_registros_ocr_excel
LIMIT 50;
