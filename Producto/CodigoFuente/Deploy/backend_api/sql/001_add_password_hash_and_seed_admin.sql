-- =========================================================
-- MIGRACIÓN DE SEGURIDAD PARA BLUEGRIDOCR
-- =========================================================
-- Objetivo:
-- - Agregar password_hash para no guardar contraseñas en texto plano.
-- - Crear roles base si no existen.
-- - Crear usuario admin inicial con contraseña real: admin1234.
--
-- Hash bcrypt admin1234:
-- $2y$12$Z/c.TZTylWpevHeETwQwRO1bsdD98FfhnONrhf0MD0mOGCyFKLMT.
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
    username,
    nombre_completo,
    password_hash,
    fk_rol
)
SELECT
    'admin',
    'Administrador General',
    '$2y$12$Z/c.TZTylWpevHeETwQwRO1bsdD98FfhnONrhf0MD0mOGCyFKLMT.',
    r.id_rol
FROM roles r
WHERE LOWER(r.nombre_rol) = 'admin'
AND NOT EXISTS (
    SELECT 1 FROM usuarios WHERE username = 'admin'
);
