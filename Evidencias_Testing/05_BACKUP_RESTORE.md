# BluegridOCR — Procedimiento de respaldo y restauración de base de datos

---

## 3.10. Procedimiento de respaldo y restauración de base de datos

Para garantizar trazabilidad, continuidad y validación del ambiente de pruebas, BluegridOCR contempla un procedimiento de respaldo y restauración de la base de datos PostgreSQL/Supabase. Este procedimiento permite extraer una copia controlada del entorno productivo o de referencia y restaurarla en un ambiente de pruebas, verificando que las tablas, relaciones y registros necesarios para la operación del sistema se encuentren disponibles.

---

## 9.1 Backup desde producción

```bash
# Crear directorio de backups
mkdir -p backups

# Exportar la base de datos completa en formato comprimido
pg_dump "$DATABASE_URL" \
    -F c \
    -b \
    -v \
    -f backups/bluegridocr_prod_$(date +%Y%m%d_%H%M%S).backup
```

Parámetros:
| Flag | Significado |
|---|---|
| `-F c` | Formato custom (comprimido, recomendado) |
| `-b` | Incluir objetos grandes (blobs) |
| `-v` | Verbose (muestra progreso) |
| `-f` | Archivo de salida |

---

## 9.2 Restauración en ambiente de pruebas

```bash
# Restaurar en base de datos de prueba
pg_restore \
    -d "$DATABASE_URL_TEST" \
    -v \
    --clean \
    --if-exists \
    backups/bluegridocr_prod_<FECHA>.backup
```

Parámetros:
| Flag | Significado |
|---|---|
| `--clean` | Elimina objetos existentes antes de recrearlos |
| `--if-exists` | No falla si los objetos no existen |
| `-v` | Verbose |

---

## 9.3 Alternativa con pg_dump en SQL plano

```bash
# Exportar como SQL legible
pg_dump "$DATABASE_URL" \
    -F p \
    --no-owner \
    --no-acl \
    -f backups/bluegridocr_backup.sql

# Restaurar en ambiente de pruebas
psql "$DATABASE_URL_TEST" -f backups/bluegridocr_backup.sql
```

---

## 9.4 Validación posterior a la restauración

```sql
-- Verificar tablas principales
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar datos críticos
SELECT COUNT(*) AS total_roles FROM roles;
SELECT COUNT(*) AS total_usuarios FROM usuarios;
SELECT COUNT(*) AS total_registros FROM registros_ocr;
SELECT COUNT(*) AS total_detalles FROM detalles_captura;
SELECT COUNT(*) AS total_eventos FROM auditoria_eventos;
SELECT COUNT(*) AS total_embarcaciones FROM embarcaciones;

-- Verificar integridad de roles
SELECT id_rol, nombre_rol, descripcion FROM roles ORDER BY id_rol;

-- Verificar usuarios activos con sus roles
SELECT u.correo, u.activo, r.nombre_rol
FROM usuarios u
JOIN roles r ON r.id_rol = u.fk_rol
ORDER BY u.id_usuario;

-- Verificar registros OCR con estados
SELECT estado_validacion, COUNT(*) AS cantidad
FROM registros_ocr
GROUP BY estado_validacion;
```

Resultados esperados en la BD actual (2026-05-28):
```
total_roles: 3
total_usuarios: 3 (admin, supervisor, buzo)
total_registros: 15
estado VALIDADO: 10
estado PENDIENTE_VALIDACION: 4
estado RECHAZADO: 1
total_embarcaciones: 10
```

---

## 9.5 Verificación de endpoints post-restauración

```bash
# Verificar que el sistema sigue operativo
curl http://localhost:8000/api/v1/health
# Esperado: { "status": "ok" }

curl http://localhost:8000/api/v1/ready
# Esperado: { "status": "ready", "checks": { "database": true, ... } }
```

---

## 9.6 Backup de scripts SQL (control de versiones)

Los scripts SQL del proyecto están versionados en el repositorio:

```
Producto/Scripts_BD/
├── MERBluegrid.sql         ← Script principal: tablas, roles, usuarios demo, datos iniciales
├── funcionesBluegrid.sql   ← Funciones y stored procedures
└── vistasBluegrid.sql      ← Vistas para dashboard y analítica
```

Para recrear la base desde cero:
```sql
-- 1. Ejecutar script principal
\i Producto/Scripts_BD/MERBluegrid.sql

-- 2. Ejecutar funciones
\i Producto/Scripts_BD/funcionesBluegrid.sql

-- 3. Ejecutar vistas
\i Producto/Scripts_BD/vistasBluegrid.sql
```

---

## 9.7 Migraciones versionadas del backend

El directorio `Deploy/backend_api/migrations/` contiene migraciones incrementales:

| Migración | Descripción |
|---|---|
| `001_security_roles_admin.sql` | Agrega `password_hash`, columnas de estado, roles base y usuario admin inicial |
| `002_audit_and_traceability.sql` | Crea tabla `auditoria_eventos` para trazabilidad |
| `002_seed_embarcaciones.sql` | Datos iniciales de embarcaciones |
| `003_digitalization_user_tracking.sql` | Agrega trazabilidad de usuario a registros OCR |
| `003_user_constraints.sql` | Restricciones de unicidad y FK |
| `004_indexes.sql` | Índices para login, auditoría y analítica |
| `005_feedback_ref_id.sql` | Soporte para ref_id en feedback de IA |

---

## 9.8 Evidencia de backup en repositorio

El procedimiento completo se aplica sobre la BD de Supabase con los siguientes resultados verificados:

- BD activa y accesible: ✅ (`/ready` → `database: true`)
- Tablas principales creadas: ✅
- Usuarios iniciales: ✅ (admin, supervisor, buzo)
- Datos demo: ✅ (15 registros OCR, 10 validados)
- Scripts SQL en repositorio: ✅ (`Producto/Scripts_BD/`)
