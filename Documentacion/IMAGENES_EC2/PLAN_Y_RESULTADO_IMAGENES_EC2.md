# Persistencia de imágenes en EC2 (reemplazo de Blob Storage) — Plan y resultado (Loop Engineering)

> Implementación bajo metodología Loop Engineering: cada `CUMPLE` tiene log/comando/test
> reproducible en `Documentacion/IMAGENES_EC2/logs/`. Lo no ejecutable offline queda
> `PENDIENTE` con runbook. Rama: `develop`. Fecha: 2026-06-25.

## Objetivo y regla de acceso
Persistir las imágenes en el **filesystem de la instancia EC2** (en vez de Azure Blob Storage)
y mostrarlas en las vistas que las consumen, con la regla: **solo `admin` y `supervisor`
pueden ver las imágenes almacenadas; el `buzo` recibe 403.**

## Decisiones tomadas (defaults aplicados)
1. **Alcance Fase 1**: imagen **original** (+ **warped** de debug), las 2 vistas y RBAC. Los
   recortes por celda se mantienen como base64 en `feedback_ia` (el motor OCR los consume; moverlos a archivos es Fase 2).
2. **Preview local del buzo** en `MatrixEditor`: se mantiene (es su propio archivo, blob local; no es una imagen servida por la API).
3. **Persistencia**: **bind mount** `/opt/bluegridocr/data` → `/data` (visible en la EC2, sobrevive a `--force-recreate`/rebuild).

## Esquema de identificación dentro de la instancia
`STORAGE_ROOT=/data` (contenedor) ↔ `/opt/bluegridocr/data` (EC2).
```
/data/registros/{id_registro}/original.jpg      # imagen subida por el buzo
                              /warped.png         # rectificada (debug del motor)
                              /grid_preview.png   # (reservado)
```
- Clave de identificación = `id_registro` (PK de `registros_ocr`); una carpeta por registro.
- En la BD: `registros_ocr.url_imagen_original = "registros/{id}/original.jpg"` (ruta relativa a `STORAGE_ROOT`); `url_imagen_procesada = "registros/{id}/warped.png"`. Se dejó de escribir `url_pendiente`.
- Servido SOLO por API protegida: `GET /api/v1/registros/{id}/imagen?tipo=original|warped|preview`.

## RBAC (matriz implementada)
| Acción | admin | supervisor | buzo |
|---|:--:|:--:|:--:|
| Subir (`POST /registros`) | ✅ | ✅ | ✅ |
| Ver imagen almacenada (`GET /registros/{id}/imagen`) | ✅ | ✅ | ❌ **403** |
| Preview local al subir (MatrixEditor) | ✅ | ✅ | ✅ (archivo propio) |

Defensa en profundidad: backend `require_roles(["admin","supervisor"])` (autoritativo) + frontend `hasRolePermission(role,'images:view')` (solo admin/supervisor; el buzo ni intenta cargar).

## Estado por ciclo
| Ciclo | Objetivo | Estado | Evidencia |
|---|---|---|---|
| LE-01 | Inspección baseline | **CUMPLE** | `logs/img_LE01_baseline.log` |
| LE-02 | Contrato (storage/endpoint/RBAC) | **CUMPLE** | este documento |
| LE-03 | `services/storage.py` + tests | **CUMPLE** | `logs/img_LE03-05_backend_tests.log` |
| LE-04 | Persistir imagen en `subir_registro` | **CUMPLE (lógica, con mocks)** | idem; subida real → LE-09 |
| LE-05 | Endpoint protegido + tests RBAC | **CUMPLE** (buzo 403) | idem |
| LE-06 | Frontend Dashboard + permiso | **CUMPLE** | `logs/img_LE06_frontend.log` |
| LE-07 | Volumen en compose | **CUMPLE** | `logs/img_LE07_compose.log` |
| LE-08 | RBAC real en EC2 | **PENDIENTE** (requiere deploy) | runbook abajo |
| LE-09 | E2E real en EC2 | **PENDIENTE** (deploy + ~tokens) | runbook abajo |
| LE-11 | Revalidación final | **CUMPLE** | `logs/img_LE11_revalidacion_final.log` |

## Cambios por archivo
**Backend**
- `core/config.py`: + `STORAGE_ROOT` (default `backend_api/var/images` local; `/data` en contenedor).
- `services/storage.py` (**nuevo**): `guardar_bytes`, `guardar_b64`, `ruta_imagen`, `ruta_relativa`, `existe`; valida `id` entero positivo y `tipo` ∈ {original,warped,preview} (anti path-traversal).
- `routers/operations.py`: guarda original (+warped) tras el insert y actualiza `url_imagen_*` (best-effort, no rompe el OCR si falla el disco). Nuevo endpoint `GET /registros/{id}/imagen` con `require_roles(["admin","supervisor"])`, 400 tipo inválido, 404 si no existe.
- `.gitignore`: ignora `Deploy/backend_api/var/` y `data/`.

**Frontend**
- `types.ts`: + permiso `images:view` (admin vía `admin:all`, supervisor explícito; buzo no).
- `components/Dashboard.tsx`: carga la imagen del registro vía `authFetch → blob → objectURL` (gated por `images:view`), con estados loading / imagen / "no disponible"; reemplaza el texto placeholder por `<img>`.

**Infra**
- `docker-compose.prod.yml` (raíz): `STORAGE_ROOT=/data` + `volumes: /opt/bluegridocr/data:/data`.

## LE-10 — Hallazgos
| ID | Hallazgo | Evidencia | Acción | Estado |
|----|----------|-----------|--------|--------|
| IMG-01 | El fixture `tmp_path` de pytest fallaba con `PermissionError [WinError 5]` al escanear `...\Temp\pytest-of-madzm` (ACL del entorno) | traceback en consola | Se reemplazó por `tempfile.mkdtemp` en el fixture | **CORREGIDO** |
| IMG-02 | Registros antiguos quedaron con `url_pendiente` (no se guardó su original) | — | Sin backfill posible; las vistas muestran "no disponible" con gracia | **ACEPTADO** |
| IMG-03 | Recortes por celda siguen en base64 (no en disco) | diseño | Decisión Fase 1 (el motor los consume); Fase 2 opcional | **DIFERIDO** |
| IMG-04 | Bundle frontend > 500 kB (warning preexistente) | `img_LE06_frontend.log` | code-split futuro | **ABIERTO (menor)** |

## LE-12 — Trazabilidad evidencia → afirmación
| Afirmación | Evidencia | Estado |
|---|---|---|
| storage guarda/lee y arma ruta `registros/{id}/...` | `test_guardar_y_ruta_relativa` | Cumple |
| `tipo`/`id` inválidos se rechazan (anti traversal) | `test_tipo_invalido_rechazado`, `test_id_invalido_rechazado` | Cumple |
| admin y supervisor ven la imagen (200) | `test_imagen_admin_y_supervisor_200` | Cumple |
| **el buzo NO ve imágenes (403)** | `test_imagen_buzo_403` | Cumple |
| sin token → 403 | `test_imagen_sin_token_403` | Cumple |
| imagen inexistente → 404 | `test_imagen_inexistente_404` | Cumple |
| frontend compila con el nuevo flujo | `img_LE06_frontend.log` (tsc 0, build OK) | Cumple |
| compose monta el volumen `/data` | `img_LE07_compose.log` | Cumple |
| subida real persiste y el supervisor ve la imagen en EC2 | — | **Pendiente (LE-09)** |

## LE-08 / LE-09 — Validación real en EC2 (PENDIENTE: requiere deploy + ~tokens)
No se ejecutó porque (a) el código aún no está desplegado en la EC2 (corre commit `450fe37`) y (b) la subida real consume tokens de Claude. Runbook para cerrarlo:

```bash
# 1) Publicar cambios (commit + push a develop) — requiere tu visto bueno.
# 2) En la EC2:
mkdir -p /opt/bluegridocr/data
cd /opt/bluegridocr/repo && git pull origin develop
sudo docker compose -f docker-compose.prod.yml up -d --build backend frontend
# 3) LE-08 RBAC real (sin imprimir tokens): login admin/supervisor/buzo y probar el endpoint
#    GET /api/v1/registros/{id}/imagen?tipo=original  -> admin/supervisor 200, buzo 403
# 4) LE-09 E2E: subir 1 imagen como buzo -> reabrir el registro como supervisor (Dashboard)
#    -> la imagen aparece (antes "no disponible"). Verificar archivo:
ls -la /opt/bluegridocr/data/registros/<id>/original.jpg
```

## Criterios de aceptación
- [x] Tests offline storage + RBAC con **buzo→403** demostrado.
- [x] Imagen original se persiste en `STORAGE_ROOT` y `url_imagen_original` deja de ser `url_pendiente`.
- [x] Vista Dashboard (supervisor) muestra `<img>` real para admin/supervisor.
- [x] Volumen configurado (persiste a `--force-recreate`/rebuild).
- [ ] **PENDIENTE**: validación real en EC2 (admin/supervisor ven, buzo 403, archivo en disco) — gated por deploy + tokens.
