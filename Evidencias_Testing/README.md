# Evidencias Testing - BluegridOCR

Directorio de respaldo tecnico para pruebas del sistema. La estructura sigue el patron solicitado para la entrega y agrupa evidencias por tipo de prueba.

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
|   |-- Estructura_Evidencias_Testing.png
|-- scripts/
|-- txt/
|-- README.md
|-- README_EVIDENCIAS.md
```

## Pruebas Funcionales

| Evidencia | Que prueba | Resultado |
| --- | --- | --- |
| `Pruebas_Funcionales/Prueba_Login.png` | Envia credenciales vigentes al endpoint de login y verifica autenticacion. | OK: HTTP 200, rol admin, token omitido. |
| `Pruebas_Funcionales/Prueba_SubidaDocumento.png` | Ejecuta solicitud autenticada al endpoint de registros/OCR con imagen de muestra. | OK: HTTP 200, registro generado. |
| `Pruebas_Funcionales/Prueba_ExtraccionDatos.png` | Verifica artefactos visuales del pipeline OCR/debug: original, rectificacion y grilla. | OK. |

## Pruebas API

| Evidencia | Que prueba | Resultado |
| --- | --- | --- |
| `Pruebas_API/POST_Auth.png` | `POST /api/v1/auth/login`. | Backend autentica correctamente. |
| `Pruebas_API/GET_Documentos.png` | `GET /docs`. | Swagger disponible con HTTP 200. |
| `Pruebas_API/POST_OCR.png` | `POST /api/v1/registros`. | Endpoint OCR responde HTTP 200 con token valido. |

## Pruebas de Integracion

| Evidencia | Que prueba | Resultado |
| --- | --- | --- |
| `Pruebas_Integracion/Flujo_Completo.png` | Frontend, backend, readiness y OpenAPI disponibles. | OK. |
| `Pruebas_Integracion/Integracion_Front_Back.png` | Disponibilidad del frontend, backend y respuesta OPTIONS/CORS. | OK. |
| `Pruebas_Integracion/Integracion_Back_DB.png` | `GET /api/v1/ready` confirma conexion a base de datos. | OK: `database=true`. |

## Pruebas No Funcionales

| Evidencia | Que prueba | Resultado |
| --- | --- | --- |
| `Pruebas_No_Funcionales/Rendimiento.png` | Tiempos de respuesta de `/api/v1/health` en varias muestras. | OK bajo umbral definido. |
| `Pruebas_No_Funcionales/Seguridad.png` | Acceso a ruta protegida sin token. | OK: `401 Unauthorized`. |
| `Pruebas_No_Funcionales/Compatibilidad.png` | Versiones de Python, Node, npm y compilacion backend. | OK. |

Adicionalmente, `txt/12_admin_access_users_response.txt` documenta que el usuario admin validado puede consultar `/api/v1/users` con HTTP 200.

## Archivos complementarios

La carpeta `txt/` contiene los resultados en texto/JSON de las pruebas ejecutadas. La carpeta `imagenes/` contiene artefactos visuales OCR/debug, muestras rotadas y la imagen `Estructura_Evidencias_Testing.png` para anexar al informe. La carpeta `scripts/` contiene utilidades para generar evidencias y rotar imagenes.

## Acceso de evaluacion

| Usuario | Contrasena | Rol |
| --- | --- | --- |
| `admin@bluegrid.cl` | `BGCwc5NLVULdnmItX7` | `admin` |

Este acceso fue validado contra `/api/v1/auth/login` y permite revisar los modulos administrativos. Se recomienda rotarlo despues de la evaluacion.

Para regenerar la bateria de evidencias:

```powershell
python Evidencias_Testing/scripts/generar_evidencias_testing.py
```
