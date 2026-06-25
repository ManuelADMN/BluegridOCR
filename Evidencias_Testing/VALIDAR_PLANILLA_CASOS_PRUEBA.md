# Validacion de la Planilla de Casos de Prueba BluegridOCR

Fecha de preparacion: 2026-06-25

Planilla revisada: `C:\Users\madzm\Downloads\Planilla Casos de Prueba BluegridOCR.xlsx`

Resumen encontrado en la planilla:

- Hoja `Pruebas Estandar`: validaciones E-1.1 a E-6.1.
- Hoja `Casos de Prueba`: 25 casos, desde `CP-001` hasta `CP-025`.
- Totales registrados: 25 casos, 16 OK, 1 N/A y 8 pendientes/no revisados.

## Comando unico

Para validar todos los casos automatizables de la planilla, primero deben estar levantados backend y frontend localmente, y debe existir la password de prueba en la consola. Ejecutar desde la raiz del repositorio:

```powershell
$env:BLUEGRID_TEST_PASSWORD="REEMPLAZAR_EN_LOCAL"; powershell -NoProfile -ExecutionPolicy Bypass -File .\Evidencias_Testing\scripts\validar_planilla_casos_prueba.ps1
```

El script no imprime tokens ni secretos.

Si solo quieres validar los bloques estaticos/unitarios sin backend/frontend vivos, puedes permitir que API/OCR queden como `SKIPPED`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Evidencias_Testing\scripts\validar_planilla_casos_prueba.ps1 -AllowApiSkipped
```

## Que valida

El comando genera logs en:

```text
Evidencias_Testing\txt\validacion_planilla_YYYYMMDD_HHMMSS\
```

Y un resumen JSON en:

```text
Evidencias_Testing\txt\validacion_planilla_YYYYMMDD_HHMMSS\00_resumen_validacion_planilla.json
```

Cobertura por bloque:

| Bloque | Casos cubiertos |
|---|---|
| `frontend_tests_karma` | `CP-015`, `CP-016`, `CP-019`, `E-1.1`, `E-1.2`, `E-1.3` |
| `frontend_build` | `CP-014`, `CP-015`, `CP-016`, `CP-017`, `CP-025`, `E-3.1`, `E-4.1`, `E-4.2`, `E-4.3` |
| `backend_pytest` | `CP-005`, `CP-006`, `CP-007`, `CP-008`, `CP-010`, `CP-018`, `E-2.1`, `E-3.2` |
| `backend_compile` | `CP-001`, `CP-002`, `CP-003`, `CP-004`, `CP-012`, `CP-013`, `CP-017`, `CP-021`, `CP-023` |
| `docker_compose_config` | `CP-020`, `CP-021`, `E-3.1` |
| `security_repository_scan` | `CP-004`, `CP-017`, `CP-022`, `E-3.2` |
| `api_integral_evidence_generator` | `CP-001`, `CP-002`, `CP-003`, `CP-004`, `CP-005`, `CP-008`, `CP-012`, `CP-013`, `CP-017`, `CP-021`, `CP-023`, `CP-024` |
| `api_integral_assertions` | Verifica que health, ready, frontend, login y OCR no hayan quedado `SKIPPED` o caidos |

## Prerrequisitos para cobertura completa

Para que el bloque `api_integral_evidence_generator` valide endpoints reales y OCR:

- Backend levantado en `http://127.0.0.1:8000`.
- Frontend levantado en `http://127.0.0.1:5173`.
- `.env` backend configurado con base de datos, JWT y Anthropic.
- Variable local `BLUEGRID_TEST_PASSWORD` definida para login autenticado.
- Imagen de muestra existente en `Evidencias_Testing\imagenes\01_muestra_ocr_original.jpg`.

Sin esos prerrequisitos, el comando igual ejecuta pruebas unitarias, build, compile, Docker Compose config y scan de seguridad, pero las evidencias API/OCR pueden quedar marcadas como `SKIPPED` o `REVISAR`.

## Notas de seguridad

- No imprime contenido de `.env`.
- No imprime `.pem`.
- No imprime tokens JWT.
- No versiona secretos.
- El scan falla si detecta `.env`, `.pem`, `.key` o `id_rsa` trackeados por Git.

