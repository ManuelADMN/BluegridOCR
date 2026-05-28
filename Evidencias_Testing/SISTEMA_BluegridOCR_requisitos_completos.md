# BluegridOCR — Todo lo que necesita tener el sistema para cumplir al 100%

> Documento de control técnico para asegurar que el producto, repositorio, evidencias y defensa cumplan con la rúbrica de Evaluación Parcial 2 / Capstone.

---

## 1. Propósito del sistema

BluegridOCR debe ser una plataforma web cloud/SaaS para digitalizar registros visuales de terreno asociados al monitoreo y caza de pulpos. El sistema debe permitir cargar imágenes o documentos, procesarlos mediante visión computarizada/multimodal, extraer una matriz estructurada de datos, permitir corrección humana, guardar resultados en PostgreSQL/Supabase y entregar trazabilidad, dashboard, analítica y evidencias de funcionamiento.

El sistema no debe quedar presentado solo como una idea o diseño; debe demostrar avance funcional, ambiente replicable, pruebas, seguridad, documentación técnica y evidencia de operación.

---

## 2. Componentes mínimos del sistema

| Componente | Debe existir | Evidencia esperada |
|---|---|---|
| Frontend web | Interfaz para login, carga, revisión, dashboard e historial | Capturas, código React/Vite, rutas visibles |
| Backend API | API FastAPI para autenticación, OCR, registros, usuarios, dashboard y health checks | Código, endpoints, Swagger/OpenAPI, Postman |
| Base de datos | PostgreSQL/Supabase con tablas relacionales para usuarios, roles, registros OCR, detalle y auditoría | MER, SQL, consultas de verificación |
| Motor IA/OCR | Integración con Claude Vision o servicio multimodal equivalente | Servicio/backend, prompt, request/response, logs |
| Seguridad | JWT, roles, hash de contraseña, variables de entorno, control de acceso | Código, pruebas de acceso, `.env.example` |
| Ambiente de pruebas | Entorno replicable similar a producción | Docker Compose, variables test/prod, comandos |
| Pruebas | Plan de pruebas funcionales, integración, seguridad, persistencia y validación | Matriz de pruebas, evidencias, capturas, reporte final |
| Backup/restore | Procedimiento para respaldar producción y restaurar en pruebas | Comandos `pg_dump`, `pg_restore`, evidencia SQL |
| Documentación | README técnico, manual de despliegue, estructura de repositorio y evidencias | Archivos en repo, anexos, enlaces |
| Presentación/demo | Flujo funcional del sistema y resultados | Capturas, video o demo en vivo |

---

## 3. Módulos funcionales obligatorios

### 3.1. Autenticación y sesión

El sistema debe permitir:

- Iniciar sesión con usuario y contraseña.
- Validar credenciales desde backend.
- Generar token JWT.
- Proteger rutas privadas.
- Cerrar sesión desde frontend.
- Mantener sesión mientras el token sea válido.

**Evidencias mínimas:**

- Endpoint `POST /api/v1/auth/login`.
- Captura de login funcionando.
- Prueba Postman con token JWT.
- Contraseñas almacenadas como hash, no texto plano.

---

### 3.2. Roles y permisos

Roles mínimos:

| Rol | Permisos esperados |
|---|---|
| Admin | Acceso completo, usuarios, dashboard, OCR, historial, validaciones, analítica |
| Supervisor | Dashboard, OCR, historial, validaciones, analítica |
| Buzo/Operador | Carga de imagen, digitalización y revisión limitada |

El backend debe validar permisos con RBAC, no solo ocultar botones en frontend.

**Evidencias mínimas:**

- Middleware/dependencia de roles en backend.
- Prueba de usuario sin permiso intentando acceder a módulo restringido.
- Captura o respuesta `403 Forbidden`.

---

### 3.3. Carga de archivos

El sistema debe permitir:

- Subir imágenes de tablillas, planillas o registros visuales.
- Aceptar formatos JPEG, PNG y WEBP.
- Rechazar archivos inválidos.
- Rechazar archivos que excedan tamaño máximo.
- Mostrar estado de carga y errores controlados.

**Evidencias mínimas:**

- Pantalla de carga.
- Prueba con imagen válida.
- Prueba con formato inválido.
- Validación en backend antes de llamar a Claude Vision.

---

### 3.4. Procesamiento OCR / visión computarizada

El sistema debe:

- Enviar imagen validada al backend.
- Procesar imagen con Claude Vision o motor multimodal equivalente.
- Extraer estructura tipo matriz/celdas.
- Identificar campos operativos relevantes.
- Retornar valores, confianza y estado del procesamiento.
- Manejar errores de API externa, timeout o respuesta incompleta.

**Campos sugeridos:**

- Fecha.
- Zona o sector.
- Usuario/buzo responsable.
- Matriz/celda extraída.
- Cantidad o marca por celda.
- Observaciones.
- Estado de validación.
- Confianza del OCR.

**Evidencias mínimas:**

- Request/response de OCR.
- Captura del resultado estructurado.
- Log o archivo JSON de ejemplo.
- Caso exitoso y caso con error controlado.

---

### 3.5. Visualización y corrección humana

El sistema debe permitir:

- Mostrar la matriz extraída en pantalla.
- Permitir edición manual de valores.
- Marcar celdas con baja confianza.
- Guardar correcciones.
- Validar registro antes de considerarlo definitivo.

**Evidencias mínimas:**

- Captura de matriz editable.
- Captura de corrección manual.
- Registro guardado en base de datos después de validación.

---

### 3.6. Persistencia de registros OCR

El sistema debe guardar:

- Registro principal OCR.
- Detalle fila/celda.
- Usuario responsable.
- Zona/sector.
- Fecha de carga.
- Estado del procesamiento.
- Estado de validación.
- Imagen o referencia a imagen.
- Confianza global o por celda.

**Evidencias mínimas:**

- Tablas en PostgreSQL/Supabase.
- Consulta SQL mostrando registros creados.
- Relación entre registro principal y detalle OCR.

---

### 3.7. Historial de registros

El sistema debe permitir:

- Listar registros OCR procesados.
- Filtrar por fecha.
- Filtrar por usuario/buzo.
- Filtrar por estado de validación.
- Ver detalle de un registro.
- Exportar o preparar datos para exportación.

**Evidencias mínimas:**

- Captura del historial.
- Filtros funcionando.
- Endpoint de consulta.

---

### 3.8. Dashboard operativo

El sistema debe mostrar indicadores como:

- Total de registros procesados.
- Total de pulpos o marcas detectadas.
- Porcentaje de registros validados.
- Registros pendientes.
- Actividad reciente.
- Métricas por usuario/buzo.
- Métricas por zona/sector.

**Evidencias mínimas:**

- Captura del dashboard.
- Endpoint de dashboard.
- Consulta SQL o vista que alimente las métricas.

---

### 3.9. Administración de usuarios

El sistema debe permitir al rol admin:

- Crear usuarios.
- Listar usuarios.
- Editar estado o rol si está implementado.
- Ver actividad básica por usuario.

**Evidencias mínimas:**

- Captura de administración de usuarios.
- Endpoint de usuarios.
- Prueba de acceso solo con rol admin.

---

### 3.10. Auditoría y trazabilidad

El sistema debe registrar eventos como:

- Inicio de sesión.
- Creación de usuario.
- Carga de imagen.
- Procesamiento OCR.
- Corrección manual.
- Validación de registro.
- Error de procesamiento.

**Evidencias mínimas:**

- Tabla `audit_logs` o equivalente.
- Consulta SQL con eventos.
- Registro asociado a usuario y fecha.

---

### 3.11. Exportación de resultados

El sistema debería permitir, al menos como entregable técnico o función planificada:

- Exportar registros en CSV/Excel.
- Exportar datos estructurados JSON.
- Descargar resultados procesados.

**Evidencias mínimas:**

- Botón o endpoint de exportación.
- Archivo generado o ejemplo de salida.

---

## 4. Requisitos no funcionales obligatorios

| Categoría | Requisito esperado | Cómo demostrarlo |
|---|---|---|
| Seguridad | JWT, roles, hash de contraseñas, secretos por `.env` | Pruebas de login, 401/403, código backend |
| Confidencialidad | No exponer claves reales en GitHub ni informe | `.env.example`, `.gitignore`, sin tokens visibles |
| Integridad | Registro relacionado con usuario, zona, estado y detalle | MER, SQL, FK, consulta de validación |
| Trazabilidad | Saber quién cargó, validó o modificó | Auditoría, campos `created_by`, `validated_by` |
| Disponibilidad | Sistema accesible desde navegador | Frontend desplegado/local operativo |
| Escalabilidad | Separación frontend/backend/IA/BD | Diagrama de arquitectura y Docker Compose |
| Mantenibilidad | Código modular | Estructura de carpetas, routers, services, schemas |
| Portabilidad | Ejecución con Docker | Dockerfile, docker-compose, comandos |
| Usabilidad | Flujo claro para usuario no técnico | Capturas, demo, validación visual |
| Rendimiento | Validar archivos antes de IA | Código/flujo de validación previa |
| Confiabilidad | Errores controlados | Pruebas de error, logs, respuestas HTTP |
| Observabilidad | Endpoints `/health` y `/ready` | Capturas/Postman/curl |
| Evolutividad | Motor OCR reemplazable | Capa de servicio OCR desacoplada |
| Calidad del dato | Validación humana antes de definitivo | Matriz editable, estados de validación |

---

## 5. Arquitectura mínima del sistema

### 5.1. Arquitectura lógica

```text
Usuario
  ↓
Frontend React/Vite
  ↓ HTTP/REST
Backend FastAPI
  ├── Auth/JWT/RBAC
  ├── Servicio OCR
  ├── Servicio de registros
  ├── Servicio dashboard
  ├── Servicio usuarios
  └── Servicio auditoría
        ↓
PostgreSQL/Supabase
        ↓
Vistas / funciones / consultas analíticas

Backend FastAPI
  ↓ API externa
Claude Vision / Motor multimodal
```

---

### 5.2. Arquitectura por capas

| Capa | Responsabilidad | Tecnología |
|---|---|---|
| Presentación | Interacción usuario, carga, edición, dashboard | React + Vite |
| API | Orquestación, validaciones, seguridad, endpoints | Python + FastAPI |
| IA/OCR | Interpretación visual/documental | Claude Vision |
| Persistencia | Datos estructurados, usuarios, auditoría | PostgreSQL/Supabase |
| Despliegue | Replicabilidad de ambientes | Docker / Docker Compose |
| QA | Validación funcional, integración, seguridad | Postman, pytest, SQL, capturas |

---

## 6. Modelo de datos mínimo recomendado

### 6.1. Tablas principales

| Tabla | Propósito |
|---|---|
| `roles` | Catálogo de roles del sistema |
| `users` | Usuarios autenticables |
| `zones` | Zonas, sectores o contexto territorial |
| `ocr_records` | Registro principal de cada procesamiento OCR |
| `ocr_cells` | Detalle por fila/celda o valor extraído |
| `audit_logs` | Eventos relevantes del sistema |
| `training_feedback` | Correcciones humanas para mejorar prompts/modelo/reglas |
| `boats` / `embarcaciones` | Catálogo opcional si aplica al contexto operativo |

---

### 6.2. Relaciones mínimas

```text
roles 1 ─── N users
users 1 ─── N ocr_records
zones 1 ─── N ocr_records
ocr_records 1 ─── N ocr_cells
users 1 ─── N audit_logs
ocr_records 1 ─── N audit_logs
ocr_records 1 ─── N training_feedback
```

---

### 6.3. Campos mínimos sugeridos

#### `users`

- `id`
- `name`
- `email`
- `password_hash`
- `role_id`
- `is_active`
- `created_at`

#### `ocr_records`

- `id`
- `user_id`
- `zone_id`
- `image_url` o `image_path`
- `status`
- `validation_status`
- `confidence_avg`
- `raw_response_json`
- `created_at`
- `validated_at`
- `validated_by`

#### `ocr_cells`

- `id`
- `ocr_record_id`
- `row_index`
- `column_index`
- `extracted_value`
- `corrected_value`
- `confidence`
- `is_corrected`

#### `audit_logs`

- `id`
- `user_id`
- `ocr_record_id`
- `event_type`
- `description`
- `metadata_json`
- `created_at`

---

## 7. Endpoints mínimos recomendados

### 7.1. Salud y diagnóstico

```text
GET /api/v1/health
GET /api/v1/ready
```

### 7.2. Autenticación

```text
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

### 7.3. Usuarios

```text
GET  /api/v1/users
POST /api/v1/users
GET  /api/v1/users/{id}
PUT  /api/v1/users/{id}
```

### 7.4. Contexto operacional

```text
GET /api/v1/context/zonas
GET /api/v1/context/embarcaciones
```

### 7.5. OCR / digitalización

```text
POST /api/v1/registros/process
GET  /api/v1/registros
GET  /api/v1/registros/{id}
PUT  /api/v1/registros/{id}/correcciones
POST /api/v1/registros/{id}/validar
```

### 7.6. Dashboard y analítica

```text
GET /api/v1/dashboard/data
GET /api/v1/analytics/buzos
GET /api/v1/analytics/zonas
```

### 7.7. Feedback y mejora

```text
POST /api/v1/training/feedback
GET  /api/v1/training/feedback
```

---

## 8. Ambiente de pruebas obligatorio

El sistema debe tener un ambiente de pruebas que replique producción en estructura, pero no necesariamente con datos reales sensibles.

### 8.1. Ambientes esperados

| Ambiente | Propósito | Base de datos | Variables |
|---|---|---|---|
| Desarrollo | Trabajo local del equipo | Local o Supabase dev | `.env.local` |
| Pruebas/Staging | Validación previa a entrega | Supabase test/PostgreSQL test | `.env.test` |
| Producción | Entorno final proyectado | Supabase prod/PostgreSQL prod | `.env.prod` |

---

### 8.2. Variables de entorno mínimas

```env
APP_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/bluegridocr
JWT_SECRET_KEY=change_me
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ANTHROPIC_API_KEY=change_me
ANTHROPIC_MODEL=claude-sonnet
ALLOWED_ORIGINS=https://bluegridocr.cl,http://localhost:5173
MAX_UPLOAD_MB=10
STORAGE_BUCKET=bluegridocr-captures
```

**Importante:** nunca subir `.env` real a GitHub ni dejar claves reales en el informe. Se debe subir `.env.example`.

---

### 8.3. Docker Compose esperado

Debe existir un archivo como:

```text
Producto/CodigoFuente/Deploy/docker-compose.prod.yml
```

Servicios mínimos:

- `frontend`
- `backend`
- `db` si se usa PostgreSQL local/containerizado
- red interna
- volúmenes para persistencia
- health checks si aplica

Comandos esperados:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml down
```

---

## 9. Backup y restauración de base de datos

Debe existir procedimiento documentado para respaldar producción y restaurar en pruebas.

### 9.1. Backup desde producción

```bash
mkdir -p backups
pg_dump "$DATABASE_URL_PROD" -F c -b -v -f backups/bluegridocr_prod.backup
```

### 9.2. Restauración en ambiente de pruebas

```bash
pg_restore -d "$DATABASE_URL_TEST" -v --clean --if-exists backups/bluegridocr_prod.backup
```

### 9.3. Validación posterior

```sql
SELECT COUNT(*) AS total_usuarios FROM users;
SELECT COUNT(*) AS total_registros FROM ocr_records;
SELECT COUNT(*) AS total_celdas FROM ocr_cells;
SELECT COUNT(*) AS total_auditoria FROM audit_logs;
```

### 9.4. Evidencia esperada

- Captura o log del backup generado.
- Captura o log de restauración exitosa.
- Consultas SQL de conteo.
- Confirmación de que staging quedó operativo.

---

## 10. Plan de pruebas mínimo

| ID | Tipo | Caso de prueba | Resultado esperado | Evidencia |
|---|---|---|---|---|
| CP-01 | Operativa | Login válido | Retorna JWT | Postman/captura |
| CP-02 | Seguridad | Login inválido | Error 401 | Postman/captura |
| CP-03 | Seguridad | Usuario sin rol accede a usuarios | Error 403 | Postman/captura |
| CP-04 | Validación | Subir PNG válido | Archivo aceptado | Captura UI/API |
| CP-05 | Validación | Subir archivo inválido | Archivo rechazado | Captura UI/API |
| CP-06 | Integración | Procesar imagen con Claude Vision | Retorna matriz estructurada | JSON/captura |
| CP-07 | Funcional | Corregir celda OCR | Valor corregido se guarda | Captura/SQL |
| CP-08 | Funcional | Validar registro OCR | Estado cambia a validado | Captura/SQL |
| CP-09 | Persistencia | Guardar registro y detalle | Registro en tablas | SQL |
| CP-10 | Dashboard | Cargar indicadores | KPIs visibles | Captura |
| CP-11 | Observabilidad | Consultar `/health` | HTTP 200 | curl/Postman |
| CP-12 | Observabilidad | Consultar `/ready` | DB/Claude/JWT OK o estado controlado | curl/Postman |
| CP-13 | Backup | Restaurar backup en pruebas | Datos restaurados | Log/SQL |
| CP-14 | Rendimiento | Procesar imagen dentro de tiempo aceptable | Tiempo documentado | Log |
| CP-15 | Confiabilidad | Forzar error de IA | Error controlado | Captura/log |

---

## 11. Evidencias que deben estar en el repositorio

```text
BluegridOCR/
├── README.md
├── Documentacion/
│   ├── Informe/
│   ├── CartaGantt/
│   ├── MER/
│   ├── UML/
│   └── Wireframe/
├── Producto/
│   ├── CodigoFuente/
│   │   ├── Front/
│   │   ├── backend_api/
│   │   ├── Deploy/
│   │   ├── docker-compose.prod.yml
│   │   └── README_TECNICO.md
│   ├── Scripts_BD/
│   │   ├── MERBluegrid.sql
│   │   ├── funcionesBluegrid.sql
│   │   └── vistasBluegrid.sql
│   ├── Datos_Prueba/
│   └── Evidencias_Testing/
│       ├── Pruebas_Funcionales/
│       ├── Pruebas_API/
│       ├── Pruebas_Integracion/
│       ├── Pruebas_No_Funcionales/
│       ├── Backup_Restore/
│       ├── capturas/
│       └── Reporte_Final_Testing.md
└── Gestion/
    ├── Integrantes.txt
    └── README_Gestion.md
```

---

## 12. Entregables necesarios para cerrar el sistema

| Entregable | Estado esperado |
|---|---|
| Código fuente frontend | Operativo |
| Código fuente backend | Operativo |
| Base de datos / scripts SQL | Entregados |
| MER | Entregado y explicado |
| Dockerfile backend | Entregado |
| Dockerfile frontend | Entregado |
| Docker Compose producción/pruebas | Entregado |
| `.env.example` | Entregado sin secretos reales |
| README técnico | Entregado |
| Plan de pruebas | Entregado |
| Evidencias de pruebas | Entregadas |
| Procedimiento backup/restore | Entregado |
| Capturas del sistema | Entregadas |
| Presentación final | Entregada |
| Informe actualizado | Entregado |

---

## 13. Criterios de aceptación del sistema

El sistema puede considerarse listo para defensa si cumple estos criterios:

- El usuario puede iniciar sesión correctamente.
- El backend genera y valida JWT.
- Los roles restringen módulos protegidos.
- El usuario puede cargar una imagen válida.
- El backend valida formato/tamaño antes de procesar.
- La imagen se procesa con el motor OCR/Claude Vision.
- El resultado se muestra como matriz estructurada.
- El usuario puede corregir valores.
- El supervisor/admin puede validar el registro.
- El registro y su detalle quedan guardados en PostgreSQL/Supabase.
- El dashboard muestra KPIs reales o de prueba.
- El historial permite consultar registros.
- Existe evidencia de pruebas funcionales, API, integración y seguridad.
- Existe procedimiento de backup/restore.
- El sistema puede levantarse con instrucciones documentadas.
- No existen secretos reales expuestos en el repositorio ni en el informe.

---

## 14. Checklist final del sistema

- [ ] Frontend React/Vite operativo.
- [ ] Backend FastAPI operativo.
- [ ] Login JWT funcionando.
- [ ] Roles admin/supervisor/buzo implementados.
- [ ] Carga de imagen implementada.
- [ ] Validación de formato y tamaño implementada.
- [ ] Integración Claude Vision implementada o simulada con evidencia.
- [ ] Matriz OCR editable implementada.
- [ ] Guardado de registro OCR implementado.
- [ ] Guardado de detalle por celda implementado.
- [ ] Dashboard operativo.
- [ ] Historial operativo.
- [ ] Administración de usuarios operativa.
- [ ] Auditoría básica implementada.
- [ ] MER actualizado.
- [ ] Scripts SQL entregados.
- [ ] Dockerfile backend.
- [ ] Dockerfile frontend.
- [ ] Docker Compose.
- [ ] `.env.example` sin secretos reales.
- [ ] README técnico.
- [ ] Plan de pruebas.
- [ ] Evidencias de pruebas.
- [ ] Procedimiento backup/restore.
- [ ] Capturas de sistema.
- [ ] Presentación final.
- [ ] Informe actualizado.
