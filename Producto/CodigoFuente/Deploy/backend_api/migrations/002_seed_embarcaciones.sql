-- =========================================================
-- BLUEGRIDOCR - SEMILLA DE EMBARCACIONES
-- =========================================================

-- Insertar embarcaciones base si no existen
INSERT INTO embarcaciones (id_embarcacion, matricula, nombre_embarcacion)
VALUES 
    (1, 'CB-1001', 'El Poseidón'),
    (2, 'VAL-2040', 'Mar del Sur'),
    (3, 'PM-3055', 'La Tonina'),
    (4, 'CHO-1102', 'Sirena I'),
    (5, 'QLL-5001', 'Don Pepe'),
    (6, 'ANC-8090', 'Australis'),
    (7, 'TAL-2022', 'Tiburón Blanco'),
    (8, 'CON-1010', 'Biobío Explorer'),
    (9, 'PUN-6001', 'Magallanes I'),
    (10, 'BUP-9999', 'Bluegrid Test')
ON CONFLICT (id_embarcacion) DO UPDATE 
SET matricula = EXCLUDED.matricula, 
    nombre_embarcacion = EXCLUDED.nombre_embarcacion;

-- Reiniciar secuencia si es necesario (PostgreSQL)
SELECT setval('embarcaciones_id_embarcacion_seq', (SELECT MAX(id_embarcacion) FROM embarcaciones));
