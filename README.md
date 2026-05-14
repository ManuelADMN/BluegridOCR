# BluegridOCR

## Aviso critico antes de levantar el sistema

Por razones de seguridad, el archivo `.env` real no se sube al repositorio. Las variables de entorno necesarias se encuentran documentadas dentro del informe de entrega y deben copiarse manualmente para crear el archivo:

```txt
Producto/CodigoFuente/Deploy/backend_api/.env
```

Es vital crear ese archivo en la carpeta `Deploy/backend_api` antes de ejecutar el backend, Docker o el script `run.py`. Sin ese `.env`, el sistema no tendra conexion a Supabase, clave de Anthropic ni secreto JWT.

No subir el `.env` a Git. Solo debe versionarse `.env.example`.

---

BluegridOCR es un sistema web para digitalizar planillas acuicolas mediante vision artificial. Permite subir imagenes de tablillas o plantillas de campo, procesarlas con Claude Vision, extraer una matriz estructurada de datos, corregir resultados manualmente y guardar los registros en PostgreSQL/Supabase para trazabilidad, dashboard operativo y analisis por usuario.

---

## Tabla de contenidos

* [Aviso critico antes de levantar el sistema](#aviso-critico-antes-de-levantar-el-sistema)
* [Descripcion general](#descripcion-general)
* [Estructura actualizada del proyecto](#estructura-actualizada-del-proyecto)
* [Stack tecnologico](#stack-tecnologico)
* [Variables de entorno](#variables-de-entorno)
* [Guia para levantar el servicio](#guia-para-levantar-el-servicio)
* [Ejecucion con Docker](#ejecucion-con-docker)
* [Endpoints de verificacion](#endpoints-de-verificacion)
* [Roles y permisos](#roles-y-permisos)
* [Base de datos y migraciones](#base-de-datos-y-migraciones)
* [Pruebas recomendadas](#pruebas-recomendadas)
* [Evidencias Testing](#evidencias-testing)
* [Recordatorio final sobre el .env](#recordatorio-final-sobre-el-env)

---

## Descripcion general

El sistema reduce el trabajo manual asociado a la lectura y transcripcion de planillas acuicolas. El flujo principal es:

1. El usuario inicia sesion.
2. El usuario sube una imagen de una tablilla o plantilla.
3. El backend procesa la imagen con Claude Vision.
4. El sistema genera una matriz digitalizada.
5. El usuario revisa y corrige los datos.
6. El registro se guarda en PostgreSQL/Supabase.
7. La informacion queda disponible para dashboard, trazabilidad y analisis.

---

## Estructura actualizada del proyecto

```txt
BluegridOCR/
|-- README.md
|-- .gitignore
|
|-- Documentacion/
|   |-- Informe/
|   |-- Gantt/
|   |   |-- CartaGantt.png
|   |-- MER/
|   |   |-- MER.png
|   |-- UML/
|   |   |-- CasosdeUso.png
|   |   |-- DiagramadeFlujo.png
|   |   |-- DiagramPaqueteServicios.png
|   |   |-- ModeloVista4_1.png
|   |-- Wireframe/
|
|-- Evidencias_Testing/
|   |-- README_EVIDENCIAS.md
|   |-- txt/
|   |   |-- 00_contexto_ejecucion.txt
|   |   |-- 01_backend_health.txt
|   |   |-- 02_backend_ready_db_ia_jwt.txt
|   |   |-- 03_frontend_http_status.txt
|   |   |-- 04_api_docs_status.txt
|   |   |-- 05_openapi_endpoints.txt
|   |   |-- 06_backend_py_compile.txt
|   |   |-- 07_login_admin_default.txt
|   |   |-- 08_frontend_build.txt
|   |   |-- 09_rotacion_imagen_muestra.txt
|   |   |-- 10_backend_logs_tail.txt
|   |   |-- 11_dashboard_data_response.txt
|   |-- imagenes/
|   |   |-- 01_muestra_ocr_original.jpg
|   |   |-- 02_muestra_ocr_warped.png
|   |   |-- 03_muestra_ocr_grid_preview.png
|   |   |-- 04_muestra_ocr_contact_sheet_count.png
|   |   |-- 05_muestra_ocr_original_rotada_90_clockwise.jpg
|   |-- scripts/
|       |-- rotar_tablilla.py
|
|-- Gestion/
|   |-- Integrantes.txt
|   |-- README_Gestion.md
|
|-- Producto/
|   |-- Datos_Prueba/
|   |-- Librerias/
|   |-- Scripts_BD/
|   |   |-- MERBluegrid.sql
|   |   |-- funcionesBluegrid.sql
|   |   |-- vistasBluegrid.sql
|   |
|   |-- CodigoFuente/
|       |-- .gitignore
|       |-- README.md
|       |-- run.py
|       |-- HTTPS.md
|       |-- docker-compose.prod.yml
|       |-- docker-compose.azure.yml
|       |-- docker-compose.https.yml
|       |
|       |-- Front/
|       |   |-- App.tsx
|       |   |-- index.html
|       |   |-- index.tsx
|       |   |-- package.json
|       |   |-- package-lock.json
|       |   |-- vite.config.ts
|       |   |-- tsconfig.json
|       |   |-- Dockerfile
|       |   |-- README.md
|       |   |-- metadata.json
|       |   |-- nginx.conf
|       |   |-- nginx.azure.conf
|       |   |-- nginx.https.conf
|       |   |-- config.template.js
|       |   |-- public/
|       |   |-- components/
|       |   |   |-- ui/
|       |   |-- services/
|       |   |-- lib/
|       |   |-- testing/
|       |   |   |-- specs/
|       |   |-- docker-entrypoint.d/
|       |
|       |-- Deploy/
|       |   |-- start.py
|       |   |-- Deploy.ipynb
|       |   |-- backend_api/
|       |       |-- .env.example
|       |       |-- main.py
|       |       |-- run_server.py
|       |       |-- requirements.txt
|       |       |-- Dockerfile
|       |       |-- create_admin.py
|       |       |-- seed_admin.py
|       |       |-- seed_admin_final.py
|       |       |-- test_bcrypt.py
|       |       |-- test_db.py
|       |       |-- core/
|       |       |-- dependencies/
|       |       |-- routers/
|       |       |-- services/
|       |       |-- migrations/
|       |       |-- sql/
|       |
|       |-- scripts/
|       |-- tmp/
|           |-- ocr_debug/
```

Archivo sensible requerido para ejecutar:

```txt
Producto/CodigoFuente/Deploy/backend_api/.env
```

Ese archivo debe crearse manualmente a partir de las variables indicadas en el informe de entrega.

Nota: carpetas generadas durante la ejecucion, como `node_modules/`, `dist/`, `__pycache__/`, `logs/` y archivos `.log`, pueden existir localmente pero no forman parte de la estructura que debe versionarse.

---

## Stack tecnologico

### Frontend

* React
* Vite
* TypeScript
* Tailwind CSS
* Lucide React
* Nginx para despliegue containerizado

### Backend

* Python
* FastAPI
* Uvicorn
* Psycopg2
* Python Dotenv
* Passlib + bcrypt
* Python JOSE / JWT
* Anthropic SDK

### Base de datos e IA

* PostgreSQL/Supabase
* Claude Vision mediante API de Anthropic

---

## Variables de entorno

El backend carga sus variables desde:

```txt
Producto/CodigoFuente/Deploy/backend_api/.env
```

Por seguridad, ese archivo no se incluye en el repositorio. Para crearlo:

1. Abrir el informe de entrega.
2. Copiar el bloque de variables de entorno indicado en el informe.
3. Crear el archivo `.env` dentro de `Producto/CodigoFuente/Deploy/backend_api/`.
4. Pegar las variables.
5. Guardar el archivo.

Existe un archivo de referencia sin secretos en:

```txt
Producto/CodigoFuente/Deploy/backend_api/.env.example
```

El frontend puede usar:

```txt
Producto/CodigoFuente/Front/.env
```

Contenido recomendado para desarrollo:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_ENABLE_MOCK_DATA=false
```

El `.env` del backend debe contener, como minimo:

```env
ENVIRONMENT=development
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
APP_TIMEZONE=America/Santiago
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_OCR_AUDIT_MODEL=claude-sonnet-4-6
JWT_SECRET_KEY=replace_with_a_long_random_secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:3000
HOST=127.0.0.1
PORT=8000
HTTPS_ENABLED=false
NGROK_TOKEN=
```

---

## Guia para levantar el servicio

### 1. Entrar al codigo fuente

Desde la raiz del repositorio:

```powershell
cd Producto/CodigoFuente
```

### 2. Crear el `.env` del backend

Antes de instalar o ejecutar, crear:

```txt
Producto/CodigoFuente/Deploy/backend_api/.env
```

Importante: las variables reales estan dentro del informe de entrega. Deben copiarse desde ahi y pegarse en ese archivo. El `.env` debe quedar dentro de `Deploy/backend_api`, no en la raiz del repositorio.

### 3. Crear el `.env` del frontend

Crear:

```txt
Producto/CodigoFuente/Front/.env
```

Con este contenido:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_ENABLE_MOCK_DATA=false
```

### 4. Instalar dependencias del backend

Desde `Producto/CodigoFuente`:

```powershell
pip install -r Deploy/backend_api/requirements.txt
```

### 5. Instalar dependencias del frontend

```powershell
cd Front
npm install
cd ..
```

### 6. Levantar todo con el script principal

Desde `Producto/CodigoFuente`:

```powershell
python run.py
```

Salida esperada:

```txt
============================================================
  Sistema listo
============================================================
  Frontend  -> http://localhost:5173
  Backend   -> http://127.0.0.1:8000
  API docs  -> http://127.0.0.1:8000/docs
============================================================
```

### 7. Levantar backend y frontend por separado

Backend:

```powershell
cd Producto/CodigoFuente/Deploy/backend_api
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd Producto/CodigoFuente/Front
npm run dev
```

Abrir en el navegador:

```txt
http://localhost:5173
```

Si el puerto `5173` esta ocupado, Vite puede usar `5174`. En ese caso abrir:

```txt
http://localhost:5174
```

---

## Ejecucion con Docker

Desde:

```powershell
cd Producto/CodigoFuente
```

Levantar el stack:

```powershell
docker compose -f docker-compose.prod.yml up --build
```

Servicios esperados:

| Servicio | Puerto | Descripcion |
| -------- | -----: | ----------- |
| Frontend | `3000` | React compilado servido por Nginx |
| Backend | `8000` | API FastAPI |
| PostgreSQL/Supabase | Externo | Base administrada |

Abrir:

```txt
http://localhost:3000
```

Importante para Docker: el compose productivo tambien usa el archivo:

```txt
Producto/CodigoFuente/Deploy/backend_api/.env
```

---

## Endpoints de verificacion

Con el backend arriba:

```txt
http://127.0.0.1:8000/api/v1/health
http://127.0.0.1:8000/api/v1/ready
http://127.0.0.1:8000/docs
```

`/api/v1/ready` debe confirmar:

```txt
database=true
anthropic_key=true
jwt_secret=true
```

Si alguno falla, revisar primero que el `.env` exista en `Producto/CodigoFuente/Deploy/backend_api/.env` y que las variables se hayan copiado correctamente desde el informe.

---

## Roles y permisos

| Rol | Descripcion |
| --- | ----------- |
| `admin` | Administrador general. Puede acceder a todos los modulos. |
| `supervisor` | Usuario de supervision. Puede digitalizar, ver dashboard y analizar actividad por buzo. |
| `buzo` | Usuario operativo. Solo puede digitalizar plantillas. |

| Permiso | Admin | Supervisor | Buzo |
| ------- | :---: | :--------: | :--: |
| Iniciar sesion | Si | Si | Si |
| Digitalizar plantillas | Si | Si | Si |
| Revisar matriz OCR | Si | Si | Si |
| Guardar digitalizacion | Si | Si | Si |
| Ver dashboard | Si | Si | No |
| Ver analisis por buzo | Si | Si | No |
| Crear usuarios | Si | No | No |
| Gestionar configuracion | Si | No | No |

La seguridad real se aplica en backend mediante JWT y validacion por rol.

---

## Base de datos y migraciones

La conexion a PostgreSQL/Supabase se define en `DATABASE_URL` dentro de:

```txt
Producto/CodigoFuente/Deploy/backend_api/.env
```

Migraciones:

```txt
Producto/CodigoFuente/Deploy/backend_api/migrations/
```

Scripts SQL complementarios:

```txt
Producto/Scripts_BD/
Producto/CodigoFuente/Deploy/backend_api/sql/
```

Usuario administrador inicial esperado:

| Usuario | Contrasena inicial | Rol |
| ------- | ------------------ | --- |
| `admin` | `admin1234` | `admin` |

Se recomienda cambiar la contrasena inicial despues del primer inicio de sesion.

---

## Pruebas recomendadas

Backend:

```powershell
cd Producto/CodigoFuente/Deploy/backend_api
python -m py_compile main.py
```

Frontend:

```powershell
cd Producto/CodigoFuente/Front
npm run build
```

Checks funcionales minimos:

```txt
[ ] /api/v1/health responde correctamente.
[ ] /api/v1/ready valida DB, Anthropic y JWT.
[ ] Login admin funciona con JWT.
[ ] Buzo puede digitalizar.
[ ] Supervisor puede ver dashboard.
[ ] Admin puede crear usuarios.
[ ] OCR procesa una imagen valida.
[ ] El backend rechaza archivos no permitidos.
```

---

## Evidencias Testing

La carpeta de evidencias tecnicas del proyecto se encuentra en:

```txt
Evidencias_Testing/
```

Esta carpeta corresponde al bloque de `Evidencias_Testing` solicitado para la entrega. Su objetivo es dejar respaldo verificable de que el sistema levanta, responde, valida configuracion critica, compila, construye el frontend y protege rutas privadas.

### Estructura de Evidencias_Testing

```txt
Evidencias_Testing/
|-- README_EVIDENCIAS.md
|
|-- txt/
|   |-- 00_contexto_ejecucion.txt
|   |-- 01_backend_health.txt
|   |-- 02_backend_ready_db_ia_jwt.txt
|   |-- 03_frontend_http_status.txt
|   |-- 04_api_docs_status.txt
|   |-- 05_openapi_endpoints.txt
|   |-- 06_backend_py_compile.txt
|   |-- 07_login_admin_default.txt
|   |-- 08_frontend_build.txt
|   |-- 09_rotacion_imagen_muestra.txt
|   |-- 10_backend_logs_tail.txt
|   |-- 11_dashboard_data_response.txt
|
|-- imagenes/
|   |-- 01_muestra_ocr_original.jpg
|   |-- 02_muestra_ocr_warped.png
|   |-- 03_muestra_ocr_grid_preview.png
|   |-- 04_muestra_ocr_contact_sheet_count.png
|   |-- 05_muestra_ocr_original_rotada_90_clockwise.jpg
|
|-- scripts/
|   |-- rotar_tablilla.py
```

### Contenido de cada prueba

| Archivo | Que valida | Resultado esperado |
| --- | --- | --- |
| `README_EVIDENCIAS.md` | Resumen formal de evidencias, interpretacion de resultados y checklist de entrega. | Documento de apoyo para revision. |
| `txt/00_contexto_ejecucion.txt` | Fecha, ruta del proyecto y versiones usadas de Python, Node y npm. | Contexto reproducible de ejecucion. |
| `txt/01_backend_health.txt` | Respuesta de `GET /api/v1/health`. | Backend activo con `status=ok`. |
| `txt/02_backend_ready_db_ia_jwt.txt` | Respuesta de `GET /api/v1/ready`. | `database=true`, `anthropic_key=true`, `jwt_secret=true`. |
| `txt/03_frontend_http_status.txt` | Respuesta HTTP del frontend local. | `StatusCode=200`. |
| `txt/04_api_docs_status.txt` | Disponibilidad de Swagger/FastAPI docs. | `StatusCode=200` en `/docs`. |
| `txt/05_openapi_endpoints.txt` | Publicacion de endpoints desde `openapi.json`. | Listado de endpoints disponibles. |
| `txt/06_backend_py_compile.txt` | Compilacion sintactica del backend. | `main.py` compila correctamente. |
| `txt/07_login_admin_default.txt` | Comportamiento del login con credenciales documentadas. | El backend responde y valida; la base actual rechaza `admin/admin1234`. |
| `txt/08_frontend_build.txt` | Build productivo del frontend. | `ExitCode=0`. |
| `txt/09_rotacion_imagen_muestra.txt` | Rotacion de una imagen de muestra con Pillow. | Imagen rotada generada correctamente. |
| `txt/10_backend_logs_tail.txt` | Logs recientes del backend durante las pruebas. | Peticiones reales registradas. |
| `txt/11_dashboard_data_response.txt` | Acceso a ruta protegida sin token. | `401 Unauthorized`. |

### Evidencias visuales

| Archivo | Que contiene |
| --- | --- |
| `imagenes/01_muestra_ocr_original.jpg` | Imagen original usada como muestra del flujo OCR/debug. |
| `imagenes/02_muestra_ocr_warped.png` | Imagen rectificada o preprocesada. |
| `imagenes/03_muestra_ocr_grid_preview.png` | Vista previa de grilla detectada. |
| `imagenes/04_muestra_ocr_contact_sheet_count.png` | Hoja de contacto para auditoria visual de conteo/debug. |
| `imagenes/05_muestra_ocr_original_rotada_90_clockwise.jpg` | Evidencia de rotacion generada por script. |

### Script de apoyo

El script:

```txt
Evidencias_Testing/scripts/rotar_tablilla.py
```

permite rotar una imagen de tablilla y generar una version corregida para adjuntarla como evidencia visual:

```powershell
python Evidencias_Testing/scripts/rotar_tablilla.py Evidencias_Testing/imagenes/tablilla_original_usuario.jpg Evidencias_Testing/imagenes/tablilla_usuario_rotada_90_clockwise.jpg clockwise
```

Si la orientacion correcta queda hacia el otro lado:

```powershell
python Evidencias_Testing/scripts/rotar_tablilla.py Evidencias_Testing/imagenes/tablilla_original_usuario.jpg Evidencias_Testing/imagenes/tablilla_usuario_rotada_90_counterclockwise.jpg counterclockwise
```

### Estado de cierre de evidencias

```txt
[x] Backend responde.
[x] Frontend responde.
[x] Base de datos, Anthropic y JWT estan configurados.
[x] Swagger y OpenAPI estan disponibles.
[x] Backend compila.
[x] Frontend genera build productivo.
[x] Rutas protegidas rechazan acceso sin token.
[x] Evidencias visuales OCR/debug incluidas.
[x] Script de rotacion incluido.
[ ] Falta adjuntar la imagen exacta de tablilla compartida por el usuario como archivo local.
[ ] Falta ejecutar OCR completo con usuario valido y token vigente.
```

---

## Buenas practicas operativas

* No subir `.env` al repositorio.
* Subir solo `.env.example`.
* Rotar credenciales expuestas o compartidas.
* Usar `JWT_SECRET_KEY` largo y aleatorio.
* Restringir `ALLOWED_ORIGINS` en produccion.
* Desactivar Swagger en produccion.
* No guardar contrasenas en texto plano.
* No confiar en roles enviados desde frontend.

---

## Recordatorio final sobre el `.env`

Antes de entregar, ejecutar o evaluar el proyecto, confirmar nuevamente este punto:

```txt
El archivo .env real NO esta versionado por seguridad.
Las variables reales estan dentro del informe de entrega.
El archivo debe crearse manualmente en:

Producto/CodigoFuente/Deploy/backend_api/.env
```

Si el `.env` se crea en otra carpeta, el backend no cargara las variables necesarias. La ubicacion correcta es la carpeta `Deploy/backend_api` del codigo fuente.
