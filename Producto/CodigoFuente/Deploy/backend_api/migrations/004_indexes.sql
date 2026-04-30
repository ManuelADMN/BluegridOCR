CREATE INDEX IF NOT EXISTS idx_usuarios_username
ON usuarios(username);

CREATE INDEX IF NOT EXISTS idx_usuarios_fk_rol
ON usuarios(fk_rol);

CREATE INDEX IF NOT EXISTS idx_auditoria_fk_usuario
ON auditoria_eventos(fk_usuario);

CREATE INDEX IF NOT EXISTS idx_auditoria_created_at
ON auditoria_eventos(created_at);

CREATE INDEX IF NOT EXISTS idx_auditoria_accion
ON auditoria_eventos(accion);

CREATE INDEX IF NOT EXISTS idx_registros_ocr_fk_usuario_creador
ON registros_ocr(fk_usuario_creador);

CREATE INDEX IF NOT EXISTS idx_registros_ocr_estado_validacion
ON registros_ocr(estado_validacion);

CREATE INDEX IF NOT EXISTS idx_registros_ocr_created_at
ON registros_ocr(created_at);
