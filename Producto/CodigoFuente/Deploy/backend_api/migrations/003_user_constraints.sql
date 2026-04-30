-- =========================================================
-- BLUEGRIDOCR - RESTRICCIONES DE INTEGRIDAD DE USUARIOS
-- =========================================================

-- 1. Unicidad de RUT
ALTER TABLE usuarios 
ADD CONSTRAINT uk_usuario_rut UNIQUE (rut);

-- 2. Unicidad de Correo
ALTER TABLE usuarios 
ADD CONSTRAINT uk_usuario_correo UNIQUE (correo);

-- 3. Unicidad de Tablilla por Embarcación (solo para buzos)
ALTER TABLE usuarios 
ADD CONSTRAINT uk_tablilla_por_barco UNIQUE (id_tablilla, fk_embarcacion);

-- Nota: Si los datos ya existen y están duplicados, estos comandos fallarán.
-- Es responsabilidad del admin limpiar duplicados antes de aplicar.
