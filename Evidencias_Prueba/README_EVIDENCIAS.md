# Evidencias de prueba - BluegridOCR

Fecha de generacion: 2026-05-14

Esta carpeta contiene evidencia tecnica para corroborar que el sistema BluegridOCR levanta, responde y tiene sus integraciones principales configuradas.

## Resumen ejecutivo

| Prueba | Archivo | Resultado |
| --- | --- | --- |
| Contexto de ejecucion | `txt/00_contexto_ejecucion.txt` | Generado |
| Backend health | `txt/01_backend_health.txt` | OK |
| Backend ready | `txt/02_backend_ready_db_ia_jwt.txt` | OK: DB, Anthropic y JWT configurados |
| Frontend HTTP | `txt/03_frontend_http_status.txt` | OK: HTTP 200 |
| API Docs | `txt/04_api_docs_status.txt` | OK: HTTP 200 |
| OpenAPI endpoints | `txt/05_openapi_endpoints.txt` | OK: 22 endpoints publicados |
| Compilacion backend | `txt/06_backend_py_compile.txt` | OK |
| Login admin documentado | `txt/07_login_admin_default.txt` | Backend valida credenciales; la base actual no acepta `admin/admin1234` |
| Build frontend | `txt/08_frontend_build.txt` | OK: `ExitCode=0` |
| Rotacion de imagen muestra | `txt/09_rotacion_imagen_muestra.txt` | OK |
| Logs backend | `txt/10_backend_logs_tail.txt` | Registra peticiones reales al backend |
| Dashboard sin token | `txt/11_dashboard_data_response.txt` | OK: rechaza acceso sin autenticacion con 401 |

## Evidencias tecnicas principales

### Backend operativo

El archivo `txt/01_backend_health.txt` demuestra que la API responde en:

```txt
http://127.0.0.1:8000/api/v1/health
```

El archivo `txt/02_backend_ready_db_ia_jwt.txt` demuestra que el backend reconoce:

```txt
database=true
anthropic_key=true
jwt_secret=true
```

Esto es una evidencia fuerte porque valida que el sistema no solo levanta, sino que tambien tiene configuradas sus dependencias criticas.

### Frontend operativo

El archivo `txt/03_frontend_http_status.txt` demuestra que el frontend responde con HTTP 200 en:

```txt
http://127.0.0.1:5173
```

### Documentacion interactiva de API

El archivo `txt/04_api_docs_status.txt` demuestra que Swagger esta disponible en:

```txt
http://127.0.0.1:8000/docs
```

El archivo `txt/05_openapi_endpoints.txt` lista los endpoints publicados por FastAPI.

### Build y compilacion

El archivo `txt/06_backend_py_compile.txt` confirma que `main.py` compila correctamente en Python.

El archivo `txt/08_frontend_build.txt` confirma que el build productivo del frontend se ejecuta correctamente. El resultado importante es:

```txt
ExitCode=0
```

La advertencia de bundle mayor a 500 kB no bloquea el build; es una recomendacion de optimizacion de Vite.

### Seguridad de rutas protegidas

El archivo `txt/11_dashboard_data_response.txt` demuestra que el dashboard rechaza una llamada sin token:

```txt
401 Unauthorized
```

Esto corrobora que al menos parte de la superficie protegida exige autenticacion.

## Evidencias visuales

La carpeta `imagenes/` contiene muestras generadas por el flujo OCR/debug del proyecto:

| Imagen | Uso |
| --- | --- |
| `01_muestra_ocr_original.jpg` | Imagen original de muestra OCR |
| `02_muestra_ocr_warped.png` | Imagen rectificada/preprocesada |
| `03_muestra_ocr_grid_preview.png` | Previsualizacion de grilla detectada |
| `04_muestra_ocr_contact_sheet_count.png` | Hoja de contacto de conteo/debug |
| `05_muestra_ocr_original_rotada_90_clockwise.jpg` | Evidencia de rotacion generada con script |

Estas imagenes sirven como respaldo visual del pipeline de preparacion OCR.

## Imagen de tablilla compartida por el usuario

La imagen pegada directamente en el chat no queda disponible automaticamente como archivo dentro del workspace. Para dejar evidencia exacta con esa misma imagen:

1. Guardar la imagen compartida manualmente en:

```txt
Evidencias_Prueba/imagenes/tablilla_original_usuario.jpg
```

2. Ejecutar la rotacion:

```powershell
python Evidencias_Prueba/scripts/rotar_tablilla.py Evidencias_Prueba/imagenes/tablilla_original_usuario.jpg Evidencias_Prueba/imagenes/tablilla_usuario_rotada_90_clockwise.jpg clockwise
```

3. Si la orientacion queda al reves, usar:

```powershell
python Evidencias_Prueba/scripts/rotar_tablilla.py Evidencias_Prueba/imagenes/tablilla_original_usuario.jpg Evidencias_Prueba/imagenes/tablilla_usuario_rotada_90_counterclockwise.jpg counterclockwise
```

4. Agregar ambas imagenes como evidencia:

```txt
Evidencias_Prueba/imagenes/tablilla_original_usuario.jpg
Evidencias_Prueba/imagenes/tablilla_usuario_rotada_90_clockwise.jpg
```

## Evidencia OCR funcional completa

Para una evidencia OCR completa con registro en base de datos se requiere una sesion valida. El endpoint es:

```txt
POST http://127.0.0.1:8000/api/v1/registros
```

Parametros:

```txt
file=<imagen>
zona_id=<id_sector>
Authorization: Bearer <token_valido>
```

La prueba con `admin/admin1234` quedo documentada en `txt/07_login_admin_default.txt`; la base actual no acepta esas credenciales, por lo que para registrar una evidencia OCR real se debe usar un usuario vigente del ambiente.

## Checklist para entrega

```txt
[x] Backend responde health.
[x] Backend responde ready.
[x] Ready confirma DB, Anthropic y JWT.
[x] Frontend responde HTTP 200.
[x] Swagger responde HTTP 200.
[x] OpenAPI lista endpoints.
[x] Backend compila.
[x] Frontend build OK.
[x] Rutas protegidas rechazan acceso sin token.
[x] Evidencias visuales OCR/debug copiadas.
[x] Script de rotacion de tablilla incluido.
[ ] Guardar la imagen exacta compartida por el usuario y rotarla.
[ ] Ejecutar OCR con usuario valido y adjuntar respuesta.
```

