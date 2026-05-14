-- =========================================================
-- MIGRACION DE SEGURIDAD PARA BLUEGRIDOCR
-- =========================================================
-- Objetivo:
-- - Agregar password_hash para no guardar contrasenas en texto plano.
-- - Crear roles base si no existen.
-- - Crear usuario admin inicial de evaluacion.
--
-- Usuario: admin@bluegrid.cl
-- Rol: admin
-- Hash bcrypt de la contrasena de evaluacion:
-- $2b$12$Hw8EU7eW3dgQIk51/OVY2eeWSotOy/RSsf9ugP5mr5ppJFErTQTP.
-- =========================================================

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS password_hash TEXT;

INSERT INTO roles (nombre_rol)
SELECT 'admin'
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE LOWER(nombre_rol) = 'admin'
);

INSERT INTO roles (nombre_rol)
SELECT 'supervisor'
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE LOWER(nombre_rol) = 'supervisor'
);

INSERT INTO roles (nombre_rol)
SELECT 'buzo'
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE LOWER(nombre_rol) = 'buzo'
);

INSERT INTO usuarios (
    correo,
    rut,
    nombre_completo,
    password_hash,
    fk_rol,
    activo
)
SELECT
    'admin@bluegrid.cl',
    'USR-admin-bluegrid',
    'Administrador General',
    '$2b$12$Hw8EU7eW3dgQIk51/OVY2eeWSotOy/RSsf9ugP5mr5ppJFErTQTP.',
    r.id_rol,
    TRUE
FROM roles r
WHERE LOWER(r.nombre_rol) = 'admin'
AND NOT EXISTS (
    SELECT 1 FROM usuarios WHERE LOWER(correo) = LOWER('admin@bluegrid.cl')
);
