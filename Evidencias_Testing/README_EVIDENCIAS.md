# Evidencias de Prueba - BluegridOCR

Fecha de generacion: 2026-05-14  
Proyecto: BluegridOCR  
Carpeta: `Evidencias_Testing/`

Este documento resume las evidencias tecnicas generadas para demostrar que el sistema levanta correctamente, expone sus servicios, valida configuracion critica, compila, protege rutas privadas y cuenta con pruebas organizadas por categoria.

## Resultado General

```txt
Backend: OK
Frontend: OK
Base de datos: OK
Clave Anthropic configurada: OK
JWT configurado: OK
Build frontend: OK
Compilacion backend: OK
Rutas protegidas: OK
Evidencias PNG por categoria: OK
```

## Estructura

```txt
Evidencias_Testing/
|-- Pruebas_Funcionales/
|   |-- Prueba_Login.png
|   |-- Prueba_SubidaDocumento.png
|   |-- Prueba_ExtraccionDatos.png
|
|-- Pruebas_API/
|   |-- POST_Auth.png
|   |-- GET_Documentos.png
|   |-- POST_OCR.png
|
|-- Pruebas_Integracion/
|   |-- Flujo_Completo.png
|   |-- Integracion_Front_Back.png
|   |-- Integracion_Back_DB.png
|
|-- Pruebas_No_Funcionales/
|   |-- Rendimiento.png
|   |-- Seguridad.png
|   |-- Compatibilidad.png
|
|-- imagenes/
|-- scripts/
|-- txt/
|-- README.md
|-- README_EVIDENCIAS.md
```

## Detalle de Pruebas

| Categoria | Archivo | Validacion |
| --- | --- | --- |
| Funcional | `Pruebas_Funcionales/Prueba_Login.png` | Login contra `/api/v1/auth/login`. |
| Funcional | `Pruebas_Funcionales/Prueba_SubidaDocumento.png` | Solicitud al endpoint de carga OCR. |
| Funcional | `Pruebas_Funcionales/Prueba_ExtraccionDatos.png` | Existencia de artefactos OCR/debug. |
| API | `Pruebas_API/POST_Auth.png` | Prueba POST de autenticacion. |
| API | `Pruebas_API/GET_Documentos.png` | Disponibilidad de Swagger en `/docs`. |
| API | `Pruebas_API/POST_OCR.png` | Prueba POST del endpoint OCR. |
| Integracion | `Pruebas_Integracion/Flujo_Completo.png` | Frontend, backend, ready y OpenAPI disponibles. |
| Integracion | `Pruebas_Integracion/Integracion_Front_Back.png` | Conexion entre frontend y backend. |
| Integracion | `Pruebas_Integracion/Integracion_Back_DB.png` | Backend conectado a base de datos. |
| No funcional | `Pruebas_No_Funcionales/Rendimiento.png` | Latencia de `/api/v1/health`. |
| No funcional | `Pruebas_No_Funcionales/Seguridad.png` | Ruta protegida rechaza acceso sin token. |
| No funcional | `Pruebas_No_Funcionales/Compatibilidad.png` | Versiones y compilacion backend. |

## Resultados en Texto

La carpeta `txt/` conserva los resultados crudos en `.txt` y `.json`, utiles para auditoria tecnica y trazabilidad.

Archivos destacados:

```txt
txt/01_backend_health.txt
txt/02_backend_ready_db_ia_jwt.txt
txt/08_frontend_build.txt
txt/11_dashboard_data_response.txt
txt/00_resumen_generacion_evidencias.json
```

## Regeneracion

Para regenerar las pruebas:

```powershell
python Evidencias_Testing/scripts/generar_evidencias_testing.py
```

Para rotar una tablilla guardada localmente:

```powershell
python Evidencias_Testing/scripts/rotar_tablilla.py Evidencias_Testing/imagenes/tablilla_original_usuario.jpg Evidencias_Testing/imagenes/tablilla_usuario_rotada_90_clockwise.jpg clockwise
```

## Evidencia OCR Real

La evidencia OCR completa con escritura en base de datos fue ejecutada con usuario valido y token vigente:

```txt
POST /api/v1/registros
Authorization: Bearer <token_valido>
file=<imagen_tablilla>
zona_id=<id_sector>
```

El resultado quedo documentado en:

```txt
Pruebas_API/POST_OCR.png
Pruebas_Funcionales/Prueba_SubidaDocumento.png
txt/POST_OCR.json
```

Por seguridad, el token JWT, la contrasena y los recortes base64 fueron omitidos de los archivos de evidencia.
