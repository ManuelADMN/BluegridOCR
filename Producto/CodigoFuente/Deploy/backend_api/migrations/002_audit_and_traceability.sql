CREATE TABLE IF NOT EXISTS auditoria_eventos (
    id_auditoria SERIAL PRIMARY KEY,
    fk_usuario INTEGER REFERENCES usuarios(id_usuario),
    username TEXT,
    rol TEXT,
    accion TEXT NOT NULL,
    entidad TEXT,
    entidad_id TEXT,
    detalle JSONB,
    ip_origen TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
