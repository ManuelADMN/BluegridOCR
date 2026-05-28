# BluegridOCR — Modelo de datos / Modelo Entidad-Relación

> Ver también: `capturas/diagramas/MER.png` (diagrama visual).

---

## 3.2.4 Modelo de datos / Modelo Entidad-Relación

El modelo de datos de BluegridOCR se diseña para asegurar trazabilidad completa entre el usuario que carga la evidencia, la imagen procesada, el resultado OCR estructurado, las correcciones humanas y el estado de validación final. La base se implementa sobre PostgreSQL/Supabase y separa entidades de autenticación, contexto operacional, registros OCR, detalle por celda y auditoría.

---

## Tablas principales

| Tabla | Propósito | Relaciones clave |
|---|---|---|
| `roles` | Catálogo de roles del sistema (admin, supervisor, buzo) | 1:N con `usuarios` |
| `usuarios` | Usuarios autenticables del sistema | N:1 con `roles`, 1:N con `registros_ocr` |
| `sectores` | Zonas o sectores operativos (Melinka, Huenquillahue, Ancud) | 1:N con `registros_ocr` |
| `embarcaciones` | Embarcaciones pesqueras vinculadas a buzos | 1:N con `usuarios`, 1:N con `registros_ocr` |
| `tablillas` | Tablillas físicas detectadas por Claude Vision | N:1 con `embarcaciones` |
| `registros_ocr` | Registro principal de cada procesamiento OCR | N:1 con `usuarios`, N:1 con `sectores`, 1:N con `detalles_captura` |
| `detalles_captura` | Detalle por fila/celda extraída de la tablilla | N:1 con `registros_ocr` |
| `feedback_ia` | Correcciones humanas para mejorar prompts/modelo | N:1 con `usuarios`, N:1 con `registros_ocr` |
| `auditoria_eventos` | Trazabilidad de todos los eventos del sistema | N:1 con `usuarios`, N:1 con `registros_ocr` |
| `diccionarios_buzo` | Contexto OCR por buzo para Claude Vision | N:1 con `usuarios` |

---

## Relaciones entre entidades

```
roles 1 ─────────── N usuarios
sectores 1 ──────── N registros_ocr
embarcaciones 1 ─── N usuarios
embarcaciones 1 ─── N tablillas
embarcaciones 1 ─── N registros_ocr
tablillas 1 ──────── N registros_ocr
usuarios 1 ────────── N registros_ocr
usuarios 1 ────────── N auditoria_eventos
usuarios 1 ────────── N feedback_ia
registros_ocr 1 ──── N detalles_captura
registros_ocr 1 ──── N auditoria_eventos
registros_ocr 1 ──── N feedback_ia
```

---

## Campos principales por tabla

### `usuarios`
| Campo | Tipo | Descripción |
|---|---|---|
| `id_usuario` | SERIAL PK | Identificador único |
| `rut` | TEXT UNIQUE | RUT chileno |
| `nombre_completo` | TEXT | Nombre completo |
| `correo` | TEXT UNIQUE | Email (usado como username) |
| `password_hash` | TEXT | Hash bcrypt de la contraseña |
| `fk_rol` | INT FK | Rol asignado |
| `fk_embarcacion` | INT FK | Embarcación asignada (buzo) |
| `activo` | BOOLEAN | Estado del usuario |
| `created_at` | TIMESTAMP | Fecha de creación |
| `last_login_at` | TIMESTAMP | Último inicio de sesión |

### `registros_ocr`
| Campo | Tipo | Descripción |
|---|---|---|
| `id_registro` | SERIAL PK | Identificador único |
| `fk_usuario_creador` | INT FK | Usuario que cargó la imagen |
| `fk_sector` | INT FK | Zona operativa |
| `fk_embarcacion` | INT FK | Embarcación asociada |
| `fk_tablilla` | INT FK | Tablilla detectada |
| `fecha_carga` | TIMESTAMP | Fecha y hora del procesamiento |
| `url_imagen_original` | TEXT | Referencia a imagen original |
| `url_imagen_procesada` | TEXT | Referencia a imagen procesada |
| `estado_validacion` | TEXT | `PENDIENTE_VALIDACION`, `VALIDADO`, `RECHAZADO` |
| `promedio_confianza` | FLOAT | Confianza promedio del motor OCR (0–1) |
| `alerta_confianza` | INT | Flag si confianza es baja |
| `validated_by` | INT FK | Usuario que validó |
| `validated_at` | TIMESTAMP | Fecha de validación |
| `rechazo_motivo` | TEXT | Motivo de rechazo si aplica |
| `updated_at` | TIMESTAMP | Última modificación |

### `detalles_captura`
| Campo | Tipo | Descripción |
|---|---|---|
| `id_detalle` | SERIAL PK | Identificador |
| `fk_registro` | INT FK | Registro OCR padre |
| `fila_index` | INT | Número de fila en la tablilla |
| `n_nidos` | INT | Nidos detectados en la fila |
| `n_cuevas_cubiertas` | INT | Cuevas cubiertas |
| `captura_hembras_tipo` | INT | Hembras con huevos |
| `total_pulpos` | INT | Total de pulpos en la fila |
| `datos_editados` | INT | Flag si fue corregido manualmente |
| `confianza_fila` | FLOAT | Confianza del motor para esta fila |
| `editado_por` | INT FK | Usuario que editó (si aplica) |
| `updated_at` | TIMESTAMP | Última modificación |

### `auditoria_eventos`
| Campo | Tipo | Descripción |
|---|---|---|
| `id_evento` | SERIAL PK | Identificador |
| `fk_usuario` | INT FK | Usuario que generó el evento |
| `fk_registro` | INT FK | Registro asociado (si aplica) |
| `accion` | TEXT | Tipo de evento (login, upload, validate, etc.) |
| `descripcion` | TEXT | Descripción detallada |
| `metadata_json` | JSONB | Datos adicionales del evento |
| `created_at` | TIMESTAMP | Fecha y hora del evento |

---

## Datos reales en la base de datos (verificado 2026-05-28)

| Tabla | Registros actuales |
|---|---|
| `roles` | 3 (admin, supervisor, buzo) |
| `usuarios` | 3 (admin, supervisor demo, buzo demo) |
| `sectores` | 5 (Melinka x2, Huenquillahue x2, Ancud) |
| `embarcaciones` | 10 activas |
| `registros_ocr` | 15 (10 validados, 4 pendientes, 1 rechazado) |
| `detalles_captura` | múltiples filas por registro |

---

## Cómo se garantiza la trazabilidad

1. Cada `registros_ocr` tiene `fk_usuario_creador` → quién subió la imagen.
2. Al validar, se registra `validated_by` y `validated_at` → quién y cuándo validó.
3. Cada edición manual en `detalles_captura` registra `editado_por`.
4. `auditoria_eventos` captura todos los eventos críticos (login, upload, validate, reject).
5. `feedback_ia` preserva las correcciones humanas para mejorar el modelo.
