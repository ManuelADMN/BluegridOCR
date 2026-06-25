# EP3 — BluegridOCR — Entrega Final (Validación Loop Engineering)

> **Documento generado bajo metodología Loop Engineering.** Cada afirmación técnica
> marcada como `CUMPLE` está respaldada por un log, comando o archivo reproducible en
> `docs/evidencias/logs/`. Lo que no pudo demostrarse se marca `PENDIENTE`, `NO APLICA`
> o `NO CUMPLE`. No se documentan afirmaciones sin evidencia.

| Campo | Valor |
| ----- | ----- |
| Proyecto | BluegridOCR — digitalización de planillas acuícolas con visión artificial |
| Fecha de validación | 2026-06-24 |
| Rama | `develop` |
| Entorno de validación | Windows 11, Python 3.13.12, Node v24.14.0, npm 11.2.0, Docker client 29.4.3 / Compose v5.1.3 |
| Código fuente | `Producto/CodigoFuente/` (backend `Deploy/backend_api/`, frontend `Front/`) |
| Base de datos | PostgreSQL gestionado (Supabase pooler, `sslmode=require`) — externo |
| Evidencias | `docs/evidencias/logs/` (20 logs) + `Evidencias_Testing/` (capturas e históricos) |

---

## Resumen ejecutivo (estado por ciclo)

| Ciclo | Objetivo | Estado | Evidencia |
| ----- | -------- | ------ | --------- |
| LE-01 | Inspección del repositorio | **CUMPLE** | Esta sección |
| LE-02 | Ejecución local | **CUMPLE** | `local_run.log` |
| LE-03 | Ejecución con Docker | **PARCIAL** — `config` validado; `build/up` **PENDIENTE** (daemon apagado) | `docker_config.log`, `docker_build.log` |
| LE-04 | Pruebas automatizadas | **PARCIAL** — front build+tests CUMPLE; lint y pytest **NO APLICA** | `frontend_*.log`, `backend_*.log` |
| LE-05 | Endpoints | **CUMPLE** | `api_endpoints.log`, `performance_api.log` |
| LE-06 | OCR / IA | **CUMPLE** (ejecución real) | `ocr_validation.log`, `performance_ocr.log` |
| LE-07 | Base de datos | **CUMPLE** | `database_validation.log` |
| LE-08 | Seguridad | **PARCIAL** — gestión de secretos CUMPLE; hallazgos abiertos | `security_scan.log`, `dependency_audit.log` |
| LE-09 | UX/UI | **CUMPLE (código)** + verif. manual visual | `ux_checklist.log` |
| LE-10 | Hallazgos | **CUMPLE** | Esta sección |
| LE-11 | Revalidación final | **CUMPLE** | `final_revalidation.log` |
| LE-12 | Trazabilidad | **CUMPLE** | Esta sección |

---

## LE-01 — Inspección real del repositorio

**Comandos:** `ls -la`, `find -maxdepth 3`, lectura de archivos clave.

**Estructura real** (difiere de una estructura `frontend/`-`backend/` plana; el código está bajo `Producto/CodigoFuente/`):

```
BluegridOCR/
├── README.md
├── Documentacion/            (Gantt, MER, UML, Informe .docx, Wireframe)
├── Evidencias_Testing/       (capturas, txt/json, scripts de evidencia)
├── Gestion/
├── Producto/
│   ├── CodigoFuente/
│   │   ├── Front/                     # React + Vite + TS + Tailwind
│   │   ├── Deploy/
│   │   │   ├── start.py
│   │   │   └── backend_api/           # FastAPI
│   │   │       ├── main.py, core/, routers/, services/, dependencies/
│   │   │       ├── migrations/*.sql, sql/*.sql
│   │   │       ├── requirements.txt, Dockerfile, .env.example
│   │   ├── docker-compose.prod.yml / .azure.yml / .https.yml
│   │   └── run.py
│   └── Scripts_BD/  (MER/funciones/vistas .sql)
└── docs/  ← (creado en esta validación: evidencias/logs, evidencias/capturas)
```

**Frameworks y servicios detectados (reales):**

- **Backend:** FastAPI + Uvicorn; `psycopg2` (PostgreSQL/Supabase); `python-jose` (JWT); `passlib[bcrypt]`; SDK `anthropic`; `opencv-python` + `numpy` + `pillow` (preprocesamiento OCR). Fuente: `Deploy/backend_api/requirements.txt`.
- **Frontend:** React 18, Vite 5, TypeScript 5, TailwindCSS 3, lucide-react, recharts, leaflet. Testing: Jasmine + Karma. Fuente: `Front/package.json`.
- **Docker:** `docker-compose.prod.yml` (backend 8000, frontend Nginx 3000) + Dockerfiles por servicio + variantes Azure/HTTPS.
- **Config:** `.env.example` (backend y front) versionados; `.env` reales presentes y **gitignored**.

**Ausencias relevantes detectadas:**

1. **El documento objetivo `docs/EP3_BLUEGRID_ENTREGA_FINAL.md` NO existía** — se crea en esta validación.
2. **No existe suite formal de `pytest`** en el backend (solo scripts de diagnóstico).
3. **`eslint` no está instalado** pese a existir el script `npm run lint`.
4. **No hay servicio de base de datos en el compose** (la DB es externa/Supabase) — coherente con la arquitectura, pero implica dependencia de red para `/ready`, login y OCR.

---

## LE-02 — Ejecución local

**Comando:** `python -m uvicorn main:app --host 127.0.0.1 --port 8000` (desde `Deploy/backend_api/`).
**Evidencia:** `docs/evidencias/logs/local_run.log`

- Dependencias backend ya instaladas (import OK de fastapi/uvicorn/psycopg2/jose/passlib/anthropic/cv2/numpy/PIL).
- Arranque correcto: `Application startup complete` → `Uvicorn running on http://127.0.0.1:8000`.
- Log de startup real: `environment=development`, `model=claude-sonnet-4-6`, `audit_model=claude-sonnet-4-6`.
- Conexión a Supabase establecida en el primer `/ready`.

| Ítem | Estado |
| ---- | ------ |
| Instalación dependencias backend | CUMPLE (preinstaladas, import OK) |
| Arranque backend (uvicorn) | CUMPLE |
| Health / ready | CUMPLE (ver LE-05) |
| API docs (FastAPI `/docs`) | CUMPLE (200 en development) |
| Variables de entorno necesarias | CUMPLE (`.env` real cargado) |
| Frontend dev server (`npm run dev`) en vivo | NO EJECUTADO este ciclo — se validó build + tests (LE-04). Marcado verif. manual. |

---

## LE-03 — Ejecución con Docker

**Evidencia:** `docker_config.log`, `docker_build.log`, `docker_up.log`, `docker_ps.log`, `docker_logs.log`

| Paso | Resultado |
| ---- | --------- |
| `docker --version` / `docker compose version` | OK (cliente 29.4.3 / Compose v5.1.3) |
| `docker compose -f docker-compose.prod.yml config` | **VÁLIDO (exit 0)** |
| `docker compose build` | **FALLA** — `failed to connect to the docker API ... dockerDesktopLinuxEngine ... daemon` |
| `docker compose up -d` / `ps` / `logs` | **NO EJECUTADO** (daemon apagado) |

**Causa:** el daemon de **Docker Desktop no está activo** en el entorno de validación. El cliente y `config` (client-side) funcionan; `build`/`up` requieren el engine.
**Acción correctiva:** iniciar Docker Desktop y reejecutar `docker compose -f docker-compose.prod.yml up -d --build`.
**Estado final LE-03:** `config` = **CUMPLE**; `build`/`up`/`ps`/`logs` = **PENDIENTE**.

**Coherencia arquitectura ↔ Docker (de `config`):**

- Servicios: `backend` (`8000:8000`, healthcheck a `/api/v1/health`), `frontend` (`3000:80`, Nginx, healthcheck `/healthz`, `depends_on` backend healthy).
- Red: `codigofuente_default`. **Sin volúmenes** (la persistencia vive en Supabase externo, coherente).
- **Hallazgos:** (a) atributo `version` obsoleto en el compose; (b) `docker compose config` **expande el `.env` e imprime los secretos en claro** → el log fue **sanitizado** (ver H-01).

---

## LE-04 — Pruebas automatizadas

### Frontend
**Evidencia:** `frontend_build.log`, `frontend_tests.log`, `frontend_lint.log`

| Script | Comando | Resultado |
| ------ | ------- | --------- |
| Build | `npm run build` (`tsc && vite build`) | **CUMPLE** — exit 0, 2287 módulos, `dist/` generado (8.91s). *Aviso:* chunk JS de 737 kB > 500 kB. |
| Tests | `npm run test` (Karma + Jasmine, navegador Edge) | **CUMPLE** — **TOTAL: 21 SUCCESS** (apiClient, permisos por rol, seed dashboard). |
| Lint | `npm run lint` (`eslint ...`) | **NO APLICA / REQUIERE AJUSTE** — `eslint` no instalado: *"'eslint' is not recognized"*. |

### Backend
**Evidencia:** `backend_tests.log`, `backend_coverage.log`

| Acción | Comando | Resultado |
| ------ | ------- | --------- |
| Compilación | `py_compile` de main/routers/services/core/dependencies | **CUMPLE** — todos los módulos compilan. |
| Tests | `python -m pytest -q` | **NO APLICA** — *"no tests ran"* (no hay suite pytest; `test_db.py`/`test_bcrypt.py` son scripts). |
| Cobertura | `pytest --cov` | **NO APLICA** — sin tests, **no se reporta porcentaje** (no inventado). |

> **Regla aplicada:** no se inventan porcentajes de cobertura. Como no hay tests backend descubribles, se marca `PENDIENTE` y se proponen los tests mínimos (ver LE-10, M-01).

---

## LE-05 — Validación real de endpoints

**Evidencia:** `api_endpoints.log`, `performance_api.log`. OpenAPI expone **22 rutas** (`/openapi.json`).

| Método | Ruta | Payload | Esperado | Obtenido | Tiempo | Estado |
| ------ | ---- | ------- | -------- | -------- | -----: | ------ |
| GET | `/` | — | 200 | **200** | 3 ms | CUMPLE |
| GET | `/api/v1/health` | — | 200 | **200** | 3 ms | CUMPLE |
| GET | `/api/v1/ready` | — | 200 ready | **200** `{database,anthropic_key,jwt_secret}=true` | 1.39 s | CUMPLE |
| GET | `/docs` | — | 200 (dev) | **200** | — | CUMPLE |
| POST | `/api/v1/auth/login` | admin válido | 200 + JWT | **200** (role=admin, id=1) | 2.1 s | CUMPLE |
| POST | `/api/v1/auth/login` | password errónea | 401 | **401** | — | CUMPLE |
| GET | `/api/v1/dashboard/data` | sin token | 401/403 | **403** | — | CUMPLE |
| GET | `/api/v1/users` | sin token | 401/403 | **403** | — | CUMPLE |
| GET | `/api/v1/dashboard/data` | Bearer admin | 200 | **200** | 2.4 s | CUMPLE |
| GET | `/api/v1/users` | Bearer admin | 200 | **200** | 1.4 s | CUMPLE |
| GET | `/api/v1/context/zonas` | Bearer admin | 200 | **200** | 1.3 s | CUMPLE |
| GET | `/api/v1/analytics/buzos` | Bearer admin | 200 | **200** | 1.6 s | CUMPLE |

**Rendimiento (`performance_api.log`):** health = **0.0033 s**; ready = **1.39 s**; endpoints con DB ≈ 1.3–2.4 s (latencia a Supabase remoto). El control de acceso JWT está **realmente aplicado en backend** (403 sin token, 200 con token, 401 con credenciales inválidas).

---

## LE-06 — Validación real de OCR / IA

**Motor:** `services/motor_ia.py` — pipeline de dos pasadas con **Claude Vision** (modelo real `claude-sonnet-4-6`): preprocesado OpenCV (detección de 4 puntos rojos → warp de perspectiva → grilla 5×5 → contact sheets) + pasada de auditoría de conteo.
**Endpoint:** `POST /api/v1/registros` (multipart `file` + `zona_id`, requiere rol).
**Evidencia:** `ocr_validation.log`, `performance_ocr.log`.

### Validaciones de borde (reales)

| Caso | Esperado | Obtenido | Estado |
| ---- | -------- | -------- | ------ |
| Sin token | 403 | **403** | CUMPLE |
| Token + `text/plain` | 400 "Formato de imagen no permitido" | **400** | CUMPLE |

### Ejecución real de OCR

| Campo | Valor |
| ----- | ----- |
| Imagen | `Evidencias_Testing/imagenes/01_muestra_ocr_original.jpg` |
| Tamaño / MIME | 173.082 bytes / `image/jpeg` |
| Caso | Tablilla acuícola 5×5, identificador físico "T1" |
| HTTP | **200** |
| Tiempo de procesamiento | **42.23 s** (dos llamadas a Claude) |
| `ocr_status` | `procesado_ia_tablilla` |
| Confianza promedio | **0.9196** |
| Celdas detectadas | **25** (matriz completa F1C1..F5C5) |
| `tablilla_id` | `1` |
| Persistencia | `id_registro=27`, estado `PENDIENTE_VALIDACION` (ver LE-07) |

Ejemplo de extracción real (primeras filas): F1 = `[3, 4, X, "", 2]`; F2 = `[5, 5, "", X, 4]`; F3 = `[8, 5, X, "", 3]`; F4 = `[10, 4, "", X, 5]`; F5 = `[3, 2, "", X, 10]`.

> **Exactitud OCR:** *No se calcula exactitud OCR porque no existe set de verdad terreno
> (ground truth) documentado.* Se valida el **funcionamiento operativo del flujo** y la
> **estructura de salida** (25 celdas, contrato de columnas C1/C2/C5 enteros y C3/C4 X/vacío,
> confianza por celda). Para medir exactitud se requiere un set etiquetado (ver M-02).

---

## LE-07 — Validación real de base de datos

**Evidencia:** `database_validation.log` (consulta read-only vía `services/db.py`).

- **Motor:** PostgreSQL (psycopg2) sobre **Supabase pooler** (`sslmode=require`). Host **redactado**.
- **Conexión:** confirmada (`/ready.database=true` + consulta real). `db.py` exige `DATABASE_URL` y fija timezone `America/Santiago`.
- **14 tablas reales** en `public`: `usuarios, roles, registros_ocr, detalles_captura, tablillas, embarcaciones, feedback_ia, sectores, auditoria_eventos, diccionarios_buzo, diccionario_buzo_items, embarcacion_sectores, tablilla_embarcacion_historial, usuario_asignaciones_operativas`.
- **Conteos reales:** usuarios=3, roles=3, registros_ocr=17, detalles_captura=82, embarcaciones=10, feedback_ia=32, tablillas=1.
- **Migraciones/scripts:** `migrations/*.sql` (001–005) y `sql/*.sql`. Usuario admin sembrado vía `create_admin.py`.
- **Persistencia verificada (CRUD real):** el registro insertado por el OCR en LE-06 se leyó de vuelta → `id_registro=27`, `estado=PENDIENTE_VALIDACION`, `promedio_confianza=0.9196`, `tablilla='1'`, `fecha_carga=2026-06-24 20:56:08` + **5 filas** en `detalles_captura`.

**Estado LE-07:** **CUMPLE.** No se expusieron credenciales. (No aplica el caso "sin base de datos": el sistema sí persiste.)

---

## LE-08 — Validación real de seguridad

**Evidencia:** `security_scan.log`, `dependency_audit.log`.

| Verificación | Resultado | Estado |
| ------------ | --------- | ------ |
| `.env` versionado | Solo `.env.example` está trackeado; `.env` reales **gitignored** (root y `CodigoFuente/.gitignore`) | CUMPLE |
| Secretos hardcodeados en código | **Ninguno** — `config.py` usa `os.getenv(...)`; búsqueda de `sk-ant-api`/`postgresql://...@` en código versionado = vacío | CUMPLE |
| `.env.example` sin secretos reales | CUMPLE (solo placeholders) | CUMPLE |
| Logs sin tokens/contraseñas | `docker_config.log` **sanitizado** tras detectar fuga; tokens redactados en evidencias | CUMPLE (tras corrección) |
| Validación de archivos (OCR) | Tipo (`jpeg/png/webp`) + tamaño (8 MB) validados antes del motor IA | CUMPLE (LE-06) |
| CORS | `ALLOWED_ORIGINS` configurable; en `development` agrega orígenes locales | CUMPLE |
| Rutas protegidas | JWT + `require_roles(...)` aplicados (403 sin token) | CUMPLE |
| Manejo de errores | Login devuelve 401 genérico; DB caída → 503; excepciones logueadas sin filtrar secretos | CUMPLE |
| `npm audit` | **9 vulnerabilidades (3 high, 5 moderate, 1 low)** — en dev-deps (karma→engine.io→ws), no en bundle de producción | REQUIERE AJUSTE |
| `pip-audit` | **No instalado** | PENDIENTE |

**Hallazgo crítico de seguridad (H-02):** la **contraseña del admin** (`BGC***************`) está en **texto claro en archivos versionados**: `README.md` (×2) y `Evidencias_Testing/README*.md` (×2). Es una credencial **funcional contra la base Supabase en vivo** (login real 200). Aunque está documentada "para evaluación", constituye exposición de credenciales en el repositorio.

---

## LE-09 — Validación UX/UI

**Evidencia:** `ux_checklist.log` + capturas en `Evidencias_Testing/Pruebas_Funcionales/`.
Método: inspección de código del frontend (no se ejecutó automatización de navegador en este ciclo).

| Ítem | Estado | Fuente |
| ---- | ------ | ------ |
| Botones con texto claro | CUMPLE | `components/ui/button.tsx`, labels en `App.tsx` |
| Mensajes de error y éxito | CUMPLE | `NotificationToast.tsx` (success/error/warning/info) |
| Feedback al cargar/procesar | CUMPLE | estados `isLoading`/`disabled` en todos los componentes |
| Navegación / retorno / logout | CUMPLE | `App.tsx` (`view` upload/editor/success, logout) |
| Exportación / descarga | CUMPLE | `HistoryReport.tsx` (Excel/CSV, `handleExport`) + `GET /reports/export` |
| Errores visibles y comprensibles | CUMPLE | `zonesError`, `detail` del backend |
| Responsividad / íconos | VERIF. MANUAL | Tailwind + lucide-react (confirmar visualmente) |

---

## LE-10 — Tabla de hallazgos y mejoras

| ID | Ciclo LE | Hallazgo | Evidencia | Acción tomada | Revalidación | Estado final |
| -- | -------- | -------- | --------- | ------------- | ------------ | ------------ |
| H-01 | LE-03/LE-08 | `docker compose config` filtra secretos del `.env` en claro al log | `docker_config.log` | Log **sanitizado** (valores → `<REDACTED>`); nota de no pegar salida cruda | Relectura del log: sin secretos | **CORREGIDO** |
| H-02 | LE-08 | Password admin en claro en archivos versionados (README ×2, Evidencias ×2); credencial viva en Supabase | `security_scan.log` | Documentado; **no** se modifican docs de entrega sin autorización | Pendiente de decisión del autor | **ABIERTO (riesgo seguridad)** |
| H-03 | LE-04 | `npm run lint` inoperante: `eslint` no instalado | `frontend_lint.log` | Documentado como NO APLICA/REQUIERE AJUSTE | — | **ABIERTO (config)** |
| H-04 | LE-04 | Sin suite `pytest` en backend; sin cobertura medible | `backend_tests.log`, `backend_coverage.log` | Documentado; tests mínimos propuestos (M-01) | — | **ABIERTO (pendiente impl.)** |
| H-05 | LE-03 | Docker `build`/`up` no verificables (daemon apagado) | `docker_build.log` | Documentado PENDIENTE; `config` sí validado | Reintentar con Docker Desktop activo | **PENDIENTE** |
| H-06 | LE-08 | `npm audit`: 9 vulns (3 high) en dev-deps (karma/ws) | `dependency_audit.log` | Documentado; aislado a dev (no bundle prod) | `npm audit fix` pendiente | **ABIERTO (mejora)** |
| H-07 | LE-08 | `pip-audit` no instalado | `dependency_audit.log` | Documentado PENDIENTE | `pip install pip-audit` y reejecutar | **PENDIENTE** |
| H-08 | LE-03 | Atributo `version` obsoleto en `docker-compose.prod.yml` | `docker_config.log` | Documentado (warning) | Quitar la línea `version:` | **ABIERTO (mejora menor)** |
| H-09 | LE-04 | Bundle frontend > 500 kB (737 kB) sin code-splitting | `frontend_build.log` | Documentado (mejora rendimiento) | code-split / manualChunks | **ABIERTO (mejora rendimiento)** |
| M-01 | LE-04 | **Mejora:** crear tests pytest mínimos (`/health`, `/ready`, login 200/401, `/registros` 400/403) | — | Propuesta | — | **PROPUESTA** |
| M-02 | LE-06 | **Mejora:** definir set de ground truth para medir exactitud OCR | — | Propuesta | — | **PROPUESTA** |

> **Nota sobre alcance de correcciones:** en esta validación solo se corrigió H-01 (sanitizar el
> log generado por la propia validación). H-02 y el resto se **registran como pendientes
> justificados**: modificar la documentación de entrega del autor o rotar credenciales reales
> excede el mandato de "validar y documentar" sin autorización explícita.

---

## LE-11 — Revalidación final

**Evidencia:** `final_revalidation.log` (re-ejecución de casos críticos en una pasada).

| # | Caso crítico | Resultado |
| - | ------------ | --------- |
| 1 | Healthcheck backend | **200** (3 ms) |
| 2 | Ready (DB/IA/JWT) | **ready**, los 3 checks = true |
| 3 | Login admin (JWT) | **200** |
| 4 | Ruta protegida sin token | **403** |
| 5 | Build frontend | **EXIT_CODE=0** |
| 6 | Tests frontend | **21 SUCCESS** |
| 7 | Compile backend | **py_compile OK** |
| 8 | OCR imagen válida + persistencia | id 27, conf 0.9196, 25 celdas |
| 9 | Docker compose up | **PENDIENTE** (daemon) — `config` OK |
| 10 | Secretos | `.env` no versionado; sin hardcode; *(H-02 abierto)* |

---

## LE-12 — Trazabilidad evidencia → afirmación

| Afirmación en informe | Evidencia asociada | Archivo/log | Estado |
| --------------------- | ------------------ | ----------- | ------ |
| El backend levanta correctamente | startup uvicorn + health/ready | `local_run.log`, `api_endpoints.log` | **Cumple** |
| El frontend compila | `tsc && vite build` exit 0 | `frontend_build.log` | **Cumple** |
| Las pruebas frontend pasan | Karma/Jasmine 21 SUCCESS | `frontend_tests.log` | **Cumple** |
| El sistema procesa imágenes (OCR) | OCR real 200, conf 0.9196, 25 celdas | `ocr_validation.log`, `performance_ocr.log` | **Cumple** |
| Los datos persisten en BD | registro 27 + 5 detalles leídos de Supabase | `database_validation.log` | **Cumple** |
| El control de acceso funciona | 403 sin token / 200 con token / 401 cred. inválida | `api_endpoints.log` | **Cumple** |
| No hay secretos hardcodeados en código | grep en versionado = vacío; `os.getenv` | `security_scan.log` | **Cumple** |
| `.env` no está versionado | `git ls-files` solo `.env.example` | `security_scan.log` | **Cumple** |
| Docker coincide con la arquitectura | `compose config` válido (2 servicios, puertos) | `docker_config.log` | **Cumple (config)** |
| El stack levanta con Docker | `build`/`up` no ejecutados (daemon apagado) | `docker_build.log` | **Pendiente** |
| Tests backend aprobados | no existe suite pytest | `backend_tests.log` | **No aplica** |
| `npm run lint` limpio | eslint no instalado | `frontend_lint.log` | **No aplica** |
| Exactitud OCR medida | sin ground truth documentado | `ocr_validation.log` | **No aplica** |
| Password admin no expuesta | password en README versionado | `security_scan.log` | **No cumple (H-02)** |

---

## Criterio de aceptación Loop Engineering

| Criterio | Cumplido | Respaldo |
| -------- | :------: | -------- |
| Evidencia de inspección real del repositorio | ✅ | LE-01 |
| Evidencia de ejecución local o Docker | ✅ | LE-02 (`local_run.log`) |
| Evidencia de pruebas automatizadas o justificación de ausencia | ✅ | LE-04 (front CUMPLE; backend justificado NO APLICA) |
| Evidencia de endpoints probados | ✅ | LE-05 (`api_endpoints.log`) |
| Evidencia de seguridad | ✅ | LE-08 (`security_scan.log`) |
| Evidencia de rendimiento (health/API principal) | ✅ | `performance_api.log`, `performance_ocr.log` |
| Matriz de casos de prueba actualizada | ✅ | LE-05/LE-06 + `Evidencias_Testing/` |
| Tabla de hallazgos y mejoras | ✅ | LE-10 |
| Revalidación final | ✅ | LE-11 (`final_revalidation.log`) |
| Métricas reales provienen de logs | ✅ | Tiempos/confianza tomados de curl y respuesta real |
| Funcionalidades no demostradas marcadas PENDIENTE/NO APLICA/NO CUMPLE | ✅ | Docker up, lint, pytest, exactitud OCR, H-02 |

### Conclusión

El sistema **BluegridOCR está operativo y verificado de extremo a extremo en entorno local**:
backend FastAPI levantado, base Supabase conectada, login con JWT y RBAC reales, OCR con Claude
Vision procesando una imagen real (confianza 0.92, 25 celdas) y **persistencia confirmada** en la
base. El frontend **compila** y sus **21 tests pasan**.

**Quedan explícitamente abiertos** (no presentados como completados): despliegue Docker `build/up`
(**PENDIENTE**, daemon apagado — H-05), tests/cobertura backend (**NO APLICA** — H-04/M-01), lint
frontend (**NO APLICA** — H-03), exactitud OCR (**NO APLICA**, falta ground truth — M-02), `pip-audit`
(**PENDIENTE** — H-07), y un **riesgo de seguridad abierto**: contraseña de admin en claro en archivos
versionados (**H-02**). Este documento **no marca como `CUMPLE` nada que no haya sido revalidado con
evidencia**.

---

### Anexo — Inventario de evidencias (`docs/evidencias/logs/`)

`local_run.log`, `api_endpoints.log`, `performance_api.log`, `docker_config.log` (sanitizado),
`docker_build.log`, `docker_up.log`, `docker_ps.log`, `docker_logs.log`, `frontend_build.log`,
`frontend_tests.log`, `frontend_lint.log`, `backend_tests.log`, `backend_coverage.log`,
`ocr_validation.log`, `performance_ocr.log`, `database_validation.log`, `security_scan.log`,
`dependency_audit.log`, `ux_checklist.log`, `final_revalidation.log`.
