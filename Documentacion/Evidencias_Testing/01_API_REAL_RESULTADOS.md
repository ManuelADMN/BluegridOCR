# BluegridOCR — Resultados API en tiempo real (sistema con BD activa)

> Evidencia capturada el 2026-05-28 con backend en `http://127.0.0.1:8099` y base de datos Supabase/PostgreSQL activa.

---

## CP-10 y CP-11: Observabilidad — `/health` y `/ready`

### GET /api/v1/health

```http
GET http://127.0.0.1:8099/api/v1/health
HTTP 200 OK
```

```json
{
  "status": "ok",
  "service": "BluegridOCR API",
  "environment": "development"
}
```

### GET /api/v1/ready

```http
GET http://127.0.0.1:8099/api/v1/ready
HTTP 200 OK
```

```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "anthropic_key": true,
    "jwt_secret": true
  },
  "anthropic_model": "claude-sonnet-4-6"
}
```

**Interpretación:** los tres componentes críticos (`database`, `anthropic_key`, `jwt_secret`) están operativos. El estado es `"ready"`.

---

## CP-01: Login válido — POST /api/v1/auth/login

```http
POST http://127.0.0.1:8099/api/v1/auth/login
Content-Type: application/json

{ "username": "admin@bluegrid.cl", "password": "<credencial_evaluacion>" }

HTTP 200 OK
```

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "id": 1,
  "username": "admin@bluegrid.cl",
  "name": "Administrador General",
  "role": "admin"
}
```

**Interpretación:** el backend autentica credenciales válidas contra PostgreSQL/Supabase, verifica el hash bcrypt y emite un token JWT firmado.

---

## CP-02: Login inválido — 401 Unauthorized

```http
POST http://127.0.0.1:8099/api/v1/auth/login
Content-Type: application/json

{ "username": "admin@bluegrid.cl", "password": "wrongpassword" }

HTTP 401 Unauthorized
```

```json
{
  "detail": "Credenciales inválidas"
}
```

---

## CP-03: Acceso sin token — 403 Forbidden

```http
GET http://127.0.0.1:8099/api/v1/users
(sin header Authorization)

HTTP 403 Forbidden
```

```json
{
  "detail": "Not authenticated"
}
```

**Interpretación:** las rutas protegidas requieren token JWT válido. Sin token o con token inválido, el backend responde con 403.

---

## Administración de usuarios — GET /api/v1/users (solo admin)

```http
GET http://127.0.0.1:8099/api/v1/users
Authorization: Bearer <token_admin>
HTTP 200 OK
```

```json
{
  "items": [
    {
      "id_usuario": 3,
      "username": "supervisor@bluegrid.cl",
      "nombre_completo": "Supervisor Demo",
      "rol": "supervisor",
      "activo": true,
      "created_at": "2026-05-07T16:38:10.645632"
    },
    {
      "id_usuario": 4,
      "username": "buzo@bluegrid.cl",
      "nombre_completo": "Buzo Demo",
      "rol": "buzo",
      "fk_embarcacion": 10,
      "id_tablilla": "TAB-DEMO-001",
      "activo": true
    },
    {
      "id_usuario": 1,
      "username": "admin@bluegrid.cl",
      "nombre_completo": "Administrador General",
      "rol": "admin",
      "activo": true,
      "last_login_at": "2026-05-28T12:59:35.800803"
    }
  ]
}
```

**Sistema tiene 3 usuarios activos:** admin, supervisor, buzo — todos los roles implementados.

---

## Zonas y contexto operacional

```http
GET http://127.0.0.1:8099/api/v1/context/zonas
Authorization: Bearer <token_admin>
HTTP 200 OK
```

```json
[
  {"id": 1, "name": "Melinka"},
  {"id": 2, "name": "Huenquillahue"},
  {"id": 3, "name": "Ancud"}
]
```

```http
GET http://127.0.0.1:8099/api/v1/context/embarcaciones
HTTP 200 OK — 10 embarcaciones activas (El Poseidon, Mar del Sur, La Tonina, ...)
```

---

## CP-09 y CP-10: Dashboard con KPIs reales

```http
GET http://127.0.0.1:8099/api/v1/dashboard/data?fecha_desde=2026-04-01&fecha_hasta=2026-05-28
Authorization: Bearer <token_admin>
HTTP 200 OK
```

```json
{
  "summary": {
    "nidos": 257,
    "cuevas_cubiertas": 186,
    "hembras_con_huevos": 47,
    "registros": 15,
    "registros_validados": 10,
    "registros_pendientes": 4,
    "registros_rechazados": 1,
    "sectores": 5,
    "buzos": 1,
    "promedio_confianza_ocr": 0.9305,
    "ocupacion_pct": 72.4,
    "tasa_reproductiva_pct": 18.3,
    "eficiencia_validacion_pct": 66.7
  }
}
```

**Interpretación:** el dashboard consume datos reales de la BD. 15 registros OCR procesados, 93% de confianza promedio del motor IA.

---

## Analítica por buzo

```http
GET http://127.0.0.1:8099/api/v1/analytics/buzos
Authorization: Bearer <token_admin>
HTTP 200 OK
```

```json
{
  "resumen": {
    "total_plantillas": 15,
    "total_buzos": 1,
    "plantillas_validadas": 10,
    "plantillas_pendientes": 5,
    "promedio_plantillas_por_buzo": 15.0
  },
  "por_buzo": [
    {
      "id_buzo": 1,
      "nombre_buzo": "Administrador General",
      "username": "admin@bluegrid.cl",
      "total_plantillas": 15,
      "plantillas_validadas": 10,
      "plantillas_pendientes": 5,
      "ultima_digitalizacion": "2026-05-14T14:23:18.059665"
    }
  ],
  "serie_temporal": [
    {"fecha": "2026-05-07", "total_plantillas": 4},
    {"fecha": "2026-05-08", "total_plantillas": 2},
    {"fecha": "2026-05-13", "total_plantillas": 5},
    {"fecha": "2026-05-14", "total_plantillas": 4}
  ]
}
```

---

## Historial de registros OCR — GET /api/v1/reports/history

```http
GET http://127.0.0.1:8099/api/v1/reports/history
Authorization: Bearer <token_admin>
HTTP 200 OK — 15 registros retornados
```

Estados observados en BD:
| Estado | Cantidad |
|---|---|
| `VALIDADO` | 10 |
| `PENDIENTE_VALIDACION` | 4 |
| `RECHAZADO` | 1 |

---

## CP-08: Detalle de un registro OCR con celdas

```http
GET http://127.0.0.1:8099/api/v1/registros/1
Authorization: Bearer <token_admin>
HTTP 200 OK
```

```json
{
  "id_registro": 1,
  "fecha_carga": "2026-05-07T16:38:10.645632",
  "estado_validacion": "VALIDADO",
  "promedio_confianza": 0.97,
  "sector": "Melinka",
  "region": "Aysen",
  "usuario": "Administrador General",
  "detalles": [
    {"fila_index": 1, "n_nidos": 6, "n_cuevas": 4, "hembra": 2, "pulpos": 8},
    {"fila_index": 2, "n_nidos": 3, "n_cuevas": 2, "hembra": 1, "pulpos": 5}
  ]
}
```

**Interpretación:** el registro guardado preserva los detalles por fila (celdas), trazabilidad de usuario y sector, y el estado de validación.

---

## CP-06: OCR procesado con Claude Vision (evidencia de ejecución previa)

El registro id_registro=24 fue procesado el 2026-05-14 con los siguientes resultados:

```json
{
  "id_registro": 24,
  "estado": "pendiente_validacion",
  "zona_id": 1,
  "usuario_id": 1,
  "ocr_status": "procesado_ia_tablilla",
  "promedio_confianza": 0.9108,
  "tablilla_id": "1",
  "celdas_detectadas": 25
}
```

**25 celdas extraídas con 91% de confianza.** El modelo `claude-sonnet-4-6` procesó la imagen de tablilla y retornó la matriz estructurada.

---

## CP-14: Rendimiento (latencia /health)

| Muestra | ms |
|---|---|
| 1 | 4 |
| 2 | 2 |
| 3 | 2 |
| 4 | 1 |
| 5 | 1 |
| **Promedio** | **2 ms** |
| **Máximo** | **4 ms** |
| **Umbral** | 1000 ms |

**Resultado: OK — muy por debajo del umbral de 1 segundo.**

---

## Endpoints publicados (OpenAPI — 22 endpoints)

```
GET  /
GET  /api/v1/analytics/buzos
POST /api/v1/auth/login
GET  /api/v1/context/embarcaciones
GET  /api/v1/context/tablillas
GET  /api/v1/context/tablillas/{tablilla_id}
GET  /api/v1/context/zonas
GET  /api/v1/dashboard/data
GET  /api/v1/health
GET  /api/v1/ready
POST /api/v1/registros
GET  /api/v1/registros/{registro_id}
PUT  /api/v1/registros/{registro_id}/estado
PUT  /api/v1/registros/{registro_id}/rechazo
PUT  /api/v1/registros/{registro_id}/validacion
GET  /api/v1/reports/export
GET  /api/v1/reports/history
GET  /api/v1/training/excepciones/{usuario_id}
POST /api/v1/training/feedback
GET  /api/v1/users
GET  /api/v1/users/{user_id}
GET  /api/v1/users/analytics
```

---

## Compatibilidad del entorno

```
Python: 3.13.12
Node:   v24.14.0
npm:    11.2.0
Backend compile (py_compile main.py): OK
```
