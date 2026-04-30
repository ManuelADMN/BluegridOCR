ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

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
    fk_rol,
    activo,
    created_at,
    updated_at
)
SELECT
    'admin',
    'Administrador General',
    '$2y$12$Z/c.TZTylWpevHeETwQwRO1bsdD98FfhnONrhf0MD0mOGCyFKLMT.',
    r.id_rol,
    TRUE,
    NOW(),
    NOW()
FROM roles r
WHERE LOWER(r.nombre_rol) = 'admin'
AND NOT EXISTS (
    SELECT 1 FROM usuarios WHERE username = 'admin'
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'usuarios_username_unique'
    ) THEN
        ALTER TABLE usuarios
        ADD CONSTRAINT usuarios_username_unique UNIQUE (username);
    END IF;
END $$;
