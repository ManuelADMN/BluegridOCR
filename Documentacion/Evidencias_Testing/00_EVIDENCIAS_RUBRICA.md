# BluegridOCR — Índice maestro de evidencias por rúbrica

> **Actualización técnica 05-07-2026:** la evidencia histórica de esta carpeta conserva los
> resultados capturados en mayo/junio. La línea base actual expone 25 rutas `/api/v1` más la
> raíz y aprueba 52 pruebas backend, 24 frontend, 51% de cobertura de aplicación, ESLint,
> build Vite, npm audit y pip-audit.
> La trazabilidad vigente está en `Documentacion/MATRIZ_TRAZABILIDAD_TECNICA.md`.

> Documento generado el 2026-05-28. Mapea cada requisito de la Evaluación Parcial 2 / Capstone con su evidencia concreta en el repositorio.

---

## Resumen de cumplimiento

| Categoría | Estado |
|---|---|
| Configuración de servidor | ✅ Completo |
| Ambiente de pruebas replicable | ✅ Completo |
| Paridad pruebas/producción | ✅ Completo |
| Instalación de lenguajes y herramientas | ✅ Completo |
| Procedimiento backup/restore BD | ✅ Completo |
| Plan de pruebas formal | ✅ Completo (18 casos) |
| Evidencias de validación y verificación | ✅ Completo |
| Certificación de avance | ✅ Completo |
| Criterios de aceptación | ✅ Completo |
| Modelo de datos explicado | ✅ Completo |
| Evidencia técnica del repositorio | ✅ Completo |
| Contrato API / endpoints | ✅ 22 endpoints documentados |
| Seguridad (JWT, RBAC, bcrypt) | ✅ Verificado en vivo |
| OCR con IA real | ✅ 15 registros en BD |

---

## 1. Configuración de servidor

**Requisito:** describir cómo se instala y ejecuta el servidor (lenguajes, frameworks, comandos).

| Evidencia | Ubicación |
|---|---|
| Stack tecnológico completo | `04_CONFIG_SERVIDOR_DESPLIEGUE.md` |
| Dockerfile backend (Python/FastAPI) | `Producto/CodigoFuente/Deploy/backend_api/Dockerfile` |
| Dockerfile frontend (React/Nginx) | `Producto/CodigoFuente/Front/Dockerfile` |
| Docker Compose producción | `Producto/CodigoFuente/docker-compose.prod.yml` |
| Docker Compose Azure | `Producto/CodigoFuente/docker-compose.azure.yml` |
| Script de ejecución local | `Producto/CodigoFuente/run.py` |
| Dependencias Python | `Producto/CodigoFuente/Deploy/backend_api/requirements.txt` |
| Compatibilidad verificada | Python 3.13.12, Node 24.14.0, npm 11.2.0 |
| Compilación backend | `python -m py_compile main.py` → OK |
| Diagrama de arquitectura | `capturas/diagramas/ModeloVista4_1.png` |
| Captura compatibilidad | `capturas/testing/no_funcionales/Compatibilidad.png` |

---

## 2. Ambiente de pruebas replicable

**Requisito:** ambiente que replique producción, servicios levantados, variables definidas.

| Evidencia | Ubicación |
|---|---|
| Descripción del ambiente | `06_AMBIENTE_PRUEBAS.md` |
| Script unificado de arranque | `Producto/CodigoFuente/run.py` |
| Docker Compose | `Producto/CodigoFuente/docker-compose.prod.yml` |
| Variables de entorno ejemplo | `Deploy/backend_api/.env.example` y `Front/.env.example` |
| Verificación `/health` en vivo | HTTP 200, `status: ok` |
| Verificación `/ready` en vivo | `database: true, anthropic_key: true, jwt_secret: true` |
| Script de regeneración evidencias | `Evidencias_Testing/scripts/generar_evidencias_testing.py` |
| Captura flujo completo | `capturas/testing/integracion/Flujo_Completo.png` |
| Captura integración front-back | `capturas/testing/integracion/Integracion_Front_Back.png` |
| Captura backend-DB | `capturas/testing/integracion/Integracion_Back_DB.png` |

---

## 3. Paridad entre pruebas y producción

**Requisito:** el ambiente de pruebas debe replicar estructura y tecnología de producción.

| Aspecto | Pruebas | Producción | ✅ |
|---|---|---|---|
| Stack | FastAPI + React + Supabase | FastAPI + React + Supabase | ✅ |
| Motor OCR | claude-sonnet-4-6 | claude-sonnet-4-6 | ✅ |
| Autenticación | JWT HS256 | JWT HS256 | ✅ |
| RBAC | admin/supervisor/buzo | admin/supervisor/buzo | ✅ |
| Docker | docker-compose.prod.yml | docker-compose.prod.yml | ✅ |
| BD | PostgreSQL/Supabase | PostgreSQL/Supabase | ✅ |

> Única diferencia: Swagger UI habilitado en desarrollo, deshabilitado en producción (`ENVIRONMENT=production`).

---

## 4. Instalación de lenguajes, bibliotecas y herramientas

**Requisito:** documentar cómo instalar el entorno.

| Herramienta | Versión | Comando de instalación | Evidencia |
|---|---|---|---|
| Python | 3.10+ (verificado 3.13.12) | `pip install -r requirements.txt` | `capturas/testing/no_funcionales/Compatibilidad.png` |
| Node.js | 18+ (verificado 24.14.0) | Con nvm o instalador oficial | Ídem |
| npm | 11.2.0 | Incluido con Node | Ídem |
| Docker | Última estable | Instalador oficial | `docker-compose.prod.yml` |
| FastAPI + dependencias | Definidas en `requirements.txt` | `pip install -r requirements.txt` | `Deploy/backend_api/requirements.txt` |
| React + Vite | Definidas en `package.json` | `npm install` | `Front/package.json` |

---

## 5. Procedimiento de backup y restauración de base de datos

**Requisito:** demostrar capacidad de respaldar producción y restaurar en pruebas.

| Evidencia | Ubicación |
|---|---|
| Procedimiento completo | `05_BACKUP_RESTORE.md` |
| Comandos pg_dump / pg_restore | `05_BACKUP_RESTORE.md §9.1 y §9.2` |
| Consultas de validación SQL | `05_BACKUP_RESTORE.md §9.4` |
| Scripts SQL del proyecto | `Producto/Scripts_BD/MERBluegrid.sql` |
| Migraciones versionadas | `Deploy/backend_api/migrations/001..005` |
| Verificación en vivo | 15 registros OCR, 3 usuarios, 10 embarcaciones en BD |

---

## 6. Plan de pruebas formal

**Requisito:** matriz de casos de prueba con resultado esperado y evidencia.

| Evidencia | Ubicación |
|---|---|
| Plan completo (18 casos) | `02_PLAN_PRUEBAS_EJECUTADO.md` |
| Casos funcionales | CP-01, CP-04, CP-06, CP-07, CP-08 |
| Casos de seguridad | CP-02, CP-03, CP-16 |
| Casos de integración | CP-09, CP-10, CP-11, CP-12 |
| Casos de rendimiento | CP-14 (promedio 2 ms, máximo 4 ms) |
| Casos de backup | CP-13 |
| Imágenes de evidencia | `capturas/testing/` (12 PNGs) |

**Resumen:** 18/18 casos PASS, 0 fallos.

---

## 7. Evidencias de validación y verificación

**Requisito:** capturas, respuestas de API, logs y consultas SQL que demuestren funcionamiento real.

### API en tiempo real (2026-05-28)

| Endpoint | Resultado real | Evidencia |
|---|---|---|
| `GET /api/v1/health` | HTTP 200, `status: ok` | `01_API_REAL_RESULTADOS.md` |
| `GET /api/v1/ready` | HTTP 200, DB+IA+JWT todos `true` | `01_API_REAL_RESULTADOS.md` |
| `POST /api/v1/auth/login` | HTTP 200, JWT emitido, role=admin | `capturas/testing/api/POST_Auth.png` |
| `POST /api/v1/auth/login` (inválido) | HTTP 401 | `01_API_REAL_RESULTADOS.md` |
| `GET /api/v1/users` (sin token) | HTTP 403 | `capturas/testing/no_funcionales/Seguridad.png` |
| `GET /api/v1/users` (admin) | HTTP 200, 3 usuarios | `01_API_REAL_RESULTADOS.md` |
| `GET /api/v1/dashboard/data` | HTTP 200, 257 nidos, 15 registros | `01_API_REAL_RESULTADOS.md` |
| `GET /api/v1/analytics/buzos` | HTTP 200, serie temporal | `01_API_REAL_RESULTADOS.md` |
| `POST /api/v1/registros` | HTTP 200, 25 celdas OCR, conf=91% | `capturas/testing/api/POST_OCR.png` |
| `GET /api/v1/reports/history` | HTTP 200, 15 registros | `01_API_REAL_RESULTADOS.md` |

### Imágenes del pipeline OCR

| Imagen | Qué muestra |
|---|---|
| `capturas/ocr_pipeline/01_muestra_ocr_original.jpg` | Tablilla acuícola de terreno (entrada) |
| `capturas/ocr_pipeline/02_muestra_ocr_warped.png` | Tablilla rectificada (perspectiva corregida) |
| `capturas/ocr_pipeline/03_muestra_ocr_grid_preview.png` | Grilla de celdas detectada |
| `capturas/ocr_pipeline/04_muestra_ocr_contact_sheet_count.png` | Hoja de contacto con conteos por celda |

---

## 8. Certificación de avance y criterios de aceptación

**Requisito:** tabla de entregas con criterio verificable y estado.

| Entrega | Evidencia | Criterio de aceptación | Estado |
|---|---|---|---|
| Avance 1 | Problema, alcance, objetivos, requisitos | Aprobado por docente guía | Completado |
| Avance 2 | Arquitectura, diagramas, prototipo, repositorio | Funciones principales operativas | Completado |
| Entrega final | Sistema funcional, informe, presentación, evidencias | Cumple RF/RNF críticos | ✅ En proceso |

### Criterios de aceptación del sistema

| Criterio | Verificado |
|---|---|
| Usuario puede iniciar sesión | ✅ HTTP 200, JWT emitido |
| Backend genera y valida JWT | ✅ Confirmado en `/ready` y login |
| Roles restringen módulos | ✅ HTTP 403 sin token, RBAC en backend |
| Imagen válida es aceptada | ✅ 25 celdas extraídas, conf=91% |
| Backend valida formato antes de IA | ✅ HTTP 422 para archivos inválidos |
| Imagen procesada con Claude Vision | ✅ claude-sonnet-4-6 activo |
| Resultado como matriz estructurada | ✅ `detalles_captura` con filas/columnas |
| Usuario puede corregir valores | ✅ `datos_editados` en `detalles_captura` |
| Admin/supervisor validan registro | ✅ 10 registros VALIDADOS en BD |
| Registro guardado en PostgreSQL | ✅ 15 registros en BD |
| Dashboard con KPIs reales | ✅ 257 nidos, 186 cuevas, 15 registros |
| Historial permite consultar registros | ✅ `/reports/history` con 15 items |
| Pruebas funcionales, API, seguridad | ✅ 18 casos documentados |
| Procedimiento backup/restore | ✅ `05_BACKUP_RESTORE.md` |
| Sistema levantable con instrucciones | ✅ `run.py` + Docker documentado |
| Sin secretos expuestos en repo | ✅ `.env.example` sin credenciales reales |

---

## 9. Modelo de datos

**Requisito:** MER explicado con tablas, relaciones y claves.

| Evidencia | Ubicación |
|---|---|
| Documento completo | `03_MODELO_DATOS_MER.md` |
| Diagrama visual | `capturas/diagramas/MER.png` |
| Script SQL oficial | `Producto/Scripts_BD/MERBluegrid.sql` |
| Migraciones incrementales | `Deploy/backend_api/migrations/` |
| Datos en BD verificados | 15 registros OCR, 3 usuarios, 10 embarcaciones |

---

## 10. Contrato API / endpoints

**Requisito:** lista de endpoints con método, propósito y rol requerido.

| Método | Endpoint | Propósito | Rol |
|---|---|---|---|
| GET | `/api/v1/health` | Estado básico API | Público |
| GET | `/api/v1/ready` | Verifica DB, IA, JWT | Técnico |
| POST | `/api/v1/auth/login` | Autenticación | Público |
| GET | `/api/v1/users` | Listar usuarios | Admin |
| GET | `/api/v1/users/{id}` | Ver usuario | Admin |
| GET | `/api/v1/users/analytics` | Analítica por usuario | Admin |
| GET | `/api/v1/context/zonas` | Listar zonas | Admin/Supervisor/Buzo |
| GET | `/api/v1/context/embarcaciones` | Listar embarcaciones | Admin/Supervisor/Buzo |
| GET | `/api/v1/context/tablillas` | Listar tablillas | Admin/Supervisor/Buzo |
| POST | `/api/v1/registros` | Subir imagen y procesar OCR | Admin/Supervisor/Buzo |
| GET | `/api/v1/registros/{id}` | Ver detalle de registro | Admin/Supervisor |
| PUT | `/api/v1/registros/{id}/validacion` | Validar registro OCR | Admin/Supervisor |
| PUT | `/api/v1/registros/{id}/rechazo` | Rechazar registro | Admin/Supervisor |
| PUT | `/api/v1/registros/{id}/estado` | Cambiar estado | Admin/Supervisor |
| GET | `/api/v1/dashboard/data` | KPIs del dashboard | Admin/Supervisor |
| GET | `/api/v1/analytics/buzos` | Analítica por buzo | Admin/Supervisor |
| GET | `/api/v1/reports/history` | Historial de registros | Admin/Supervisor |
| GET | `/api/v1/reports/export` | Exportar datos | Admin/Supervisor |
| POST | `/api/v1/training/feedback` | Guardar correcciones IA | Admin/Supervisor |
| GET | `/api/v1/training/excepciones/{id}` | Excepciones por usuario | Admin |

**Total: 22 endpoints** — verificados en OpenAPI (`/docs`).

---

## 11. Estructura técnica del repositorio

**Requisito:** descripción de la estructura con propósito de cada carpeta.

```
BluegridOCR/
│
├── README.md                            ← Presentación y acceso del proyecto
├── Documentacion/
│   ├── docs/                            ← Evidencias para el informe (este directorio)
│   │   ├── 00_EVIDENCIAS_RUBRICA.md     ← Índice maestro (este archivo)
│   │   ├── 01_API_REAL_RESULTADOS.md    ← Respuestas API reales capturadas
│   │   ├── 02_PLAN_PRUEBAS_EJECUTADO.md ← Plan y resultados de pruebas
│   │   ├── 03_MODELO_DATOS_MER.md       ← Modelo de datos explicado
│   │   ├── 04_CONFIG_SERVIDOR_DESPLIEGUE.md ← Config servidor y deploy
│   │   ├── 05_BACKUP_RESTORE.md         ← Procedimiento backup/restore
│   │   ├── 06_AMBIENTE_PRUEBAS.md       ← Ambiente de pruebas
│   │   └── capturas/                    ← Todas las imágenes de evidencia
│   │       ├── diagramas/               ← UML, MER, Gantt
│   │       ├── ocr_pipeline/            ← Pipeline OCR visual
│   │       └── testing/                 ← Imágenes de pruebas
│   ├── Gantt/CartaGantt.png
│   ├── MER/MER.png
│   └── UML/
│       ├── CasosdeUso.png
│       ├── DiagramPaqueteServicios.png
│       ├── DiagramadeFlujo.png
│       └── ModeloVista4_1.png
│
├── Producto/
│   ├── CodigoFuente/
│   │   ├── run.py                       ← Arranque unificado
│   │   ├── docker-compose.prod.yml      ← Despliegue Docker
│   │   ├── Front/                       ← Aplicación React/Vite
│   │   └── Deploy/
│   │       └── backend_api/             ← API FastAPI
│   │           ├── main.py
│   │           ├── routers/             ← 10 routers
│   │           ├── services/            ← DB, JWT, IA, seguridad
│   │           ├── migrations/          ← SQL versionado
│   │           └── .env.example
│   └── Scripts_BD/
│       ├── MERBluegrid.sql
│       ├── funcionesBluegrid.sql
│       └── vistasBluegrid.sql
│
├── Evidencias_Testing/
│   ├── Pruebas_Funcionales/             ← PNGs login, subida, extracción
│   ├── Pruebas_API/                     ← PNGs autenticación, OCR, docs
│   ├── Pruebas_Integracion/             ← PNGs flujo completo, front-back, back-db
│   ├── Pruebas_No_Funcionales/          ← PNGs rendimiento, seguridad, compatibilidad
│   ├── imagenes/                        ← Tablillas OCR de muestra
│   ├── txt/                             ← Respuestas JSON/TXT de pruebas
│   ├── scripts/                         ← Script de generación automática
│   └── README.md
│
└── Gestion/
```

---

## 12. Diagramas disponibles

| Diagrama | Archivo |
|---|---|
| Modelo Vista 4+1 | `capturas/diagramas/ModeloVista4_1.png` |
| Casos de uso | `capturas/diagramas/CasosdeUso.png` |
| Diagrama de paquete de servicios | `capturas/diagramas/DiagramPaqueteServicios.png` |
| Diagrama de flujo | `capturas/diagramas/DiagramadeFlujo.png` |
| MER | `capturas/diagramas/MER.png` |
| Carta Gantt | `capturas/diagramas/CartaGantt.png` |

---

## 13. Acceso de evaluación

| Usuario | Contraseña | Rol | Permisos |
|---|---|---|---|
| `admin@bluegrid.cl` | (ver `seed_admin.py`) | Admin | Acceso completo |
| `supervisor@bluegrid.cl` | (ver script de seed) | Supervisor | Dashboard, OCR, validación |
| `buzo@bluegrid.cl` | (ver script de seed) | Buzo | Solo digitalización |

Sistema activo en:
```
Backend:  http://127.0.0.1:8000 (con run.py o Docker)
Frontend: http://localhost:5173  (con run.py)
API Docs: http://127.0.0.1:8000/docs
```
