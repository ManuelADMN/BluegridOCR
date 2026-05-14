# BluegridOCR

BluegridOCR es un sistema web para digitalizar planillas acuícolas mediante visión artificial. Permite subir imágenes de tablillas de campo, procesarlas con Claude Vision, extraer una matriz estructurada de datos, corregirla manualmente cuando sea necesario y guardar los registros en PostgreSQL/Supabase para trazabilidad, dashboard operativo y análisis por usuario.

---

## Tabla de contenidos

* [Objetivo](#objetivo)
* [Arquitectura](#arquitectura)
* [Stack tecnológico](#stack-tecnológico)
* [Roles y permisos](#roles-y-permisos)
* [Requisitos](#requisitos)
* [Variables de entorno](#variables-de-entorno)
* [Instalación local](#instalación-local)
* [Ejecución local](#ejecución-local)
* [Base de datos y migraciones](#base-de-datos-y-migraciones)
* [Autenticación y seguridad](#autenticación-y-seguridad)
* [Endpoints principales](#endpoints-principales)
* [Flujo OCR](#flujo-ocr)
* [Deploy con Docker](#deploy-con-docker)
* [Pruebas recomendadas](#pruebas-recomendadas)
* [Buenas prácticas operativas](#buenas-prácticas-operativas)

---

## Objetivo

El objetivo de BluegridOCR es reducir el trabajo manual asociado a la lectura y transcripción de planillas acuícolas utilizadas en terreno. El sistema entrega un flujo controlado donde el usuario puede:

1. Subir una imagen de una tablilla o plantilla.
2. Procesar la imagen con visión artificial.
3. Extraer datos por celda desde una matriz de trabajo.
4. Revisar y corregir resultados antes de guardar.
5. Persistir los datos en una base PostgreSQL/Supabase.
6. Visualizar métricas en dashboard.
7. Analizar actividad por buzo o usuario operativo.

---

## Arquitectura

```txt
BluegridOCR/
├── README.md
├── run.py
├── docker-compose.prod.yml
│
├── Front/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.ts
│   ├── App.tsx
│   ├── types.ts
│   ├── services/
│   │   └── apiClient.ts
│   └── components/
│       ├── BluegridLogo.tsx
│       ├── Dashboard.tsx
│       ├── MatrixEditor.tsx
│       ├── AdminUsersPanel.tsx
│       ├── BuzoAnalytics.tsx
│       ├── NotificationToast.tsx
│       └── SettingsModal.tsx
│
└── Deploy/
    ├── start.py
    ├── Deploy.ipynb
    └── backend_api/
        ├── Dockerfile
        ├── .dockerignore
        ├── .env.example
        ├── main.py
        ├── requirements.txt
        │
        ├── core/
        │   ├── config.py
        │   └── logger.py
        │
        ├── dependencies/
        │   └── auth.py
        │
        ├── migrations/
        │   ├── 001_security_roles_admin.sql
        │   ├── 002_audit_and_traceability.sql
        │   ├── 003_digitalization_user_tracking.sql
        │   └── 004_indexes.sql
        │
        ├── routers/
        │   ├── auth.py
        │   ├── users.py
        │   ├── context.py
        │   ├── dashboard.py
        │   ├── operations.py
        │   ├── supervision.py
        │   ├── analytics.py
        │   ├── health.py
        │   ├── audit.py
        │   └── training.py
        │
        └── services/
            ├── db.py
            ├── motor_ia.py
            ├── security.py
            └── jwt_service.py
```

### Componentes principales

| Componente                | Descripción                                                                      |
| ------------------------- | -------------------------------------------------------------------------------- |
| `Front/`                  | Aplicación web React + Vite + TypeScript.                                        |
| `Deploy/backend_api/`     | API FastAPI encargada de autenticación, OCR, dashboard, usuarios y persistencia. |
| `services/motor_ia.py`    | Motor de procesamiento visual basado en Claude Vision.                           |
| `services/db.py`          | Conexión a PostgreSQL/Supabase usando `DATABASE_URL`.                            |
| `services/security.py`    | Hash y verificación de contraseñas con bcrypt.                                   |
| `services/jwt_service.py` | Creación y validación de tokens JWT.                                             |
| `dependencies/auth.py`    | Middleware/dependencias para autenticación y autorización por rol.               |
| `migrations/`             | Scripts SQL versionados para preparar la base de datos.                          |
| `docker-compose.prod.yml` | Orquestación de frontend y backend para despliegue.                              |

---

## Stack tecnológico

### Frontend

* React
* Vite
* TypeScript
* Tailwind CSS
* Lucide React

### Backend

* Python
* FastAPI
* Uvicorn
* Psycopg2
* Python Dotenv
* Passlib + bcrypt
* Python JOSE / JWT
* Anthropic SDK

### Base de datos

* PostgreSQL
* Supabase como proveedor administrado recomendado

### IA / OCR

* Claude Vision
* Procesamiento de imagen en backend
* Matriz editable en frontend
* Validación humana antes del guardado definitivo

---

## Roles y permisos

BluegridOCR utiliza control de acceso basado en roles.

| Rol          | Descripción                                                                             |
| ------------ | --------------------------------------------------------------------------------------- |
| `admin`      | Administrador general. Puede acceder a todos los módulos.                               |
| `supervisor` | Usuario de supervisión. Puede digitalizar, ver dashboard y analizar actividad por buzo. |
| `buzo`       | Usuario operativo de terreno. Solo puede digitalizar plantillas.                        |

### Matriz de permisos

| Permiso                      | Admin |                 Supervisor | Buzo |
| ---------------------------- | ----: | -------------------------: | ---: |
| Iniciar sesión               |    Sí |                         Sí |   Sí |
| Digitalizar plantillas       |    Sí |                         Sí |   Sí |
| Revisar matriz OCR           |    Sí |                         Sí |   Sí |
| Guardar digitalización       |    Sí |                         Sí |   Sí |
| Ver dashboard                |    Sí |                         Sí |   No |
| Ver análisis por buzo        |    Sí |                         Sí |   No |
| Crear usuarios               |    Sí |                         No |   No |
| Ver administración           |    Sí |                         No |   No |
| Gestionar configuración      |    Sí |                         No |   No |
| Validar registros históricos |    Sí | Sí, según regla de negocio |   No |

> La seguridad real se aplica en backend mediante JWT y validación por rol. El frontend solo oculta o muestra módulos para mejorar la experiencia de usuario.

---

## Requisitos

* Python 3.10 o superior.
* Node.js 18 o superior.
* npm.
* Docker y Docker Compose, si se usará despliegue containerizado.
* Cuenta Anthropic con API key activa.
* Base PostgreSQL/Supabase disponible.
* Git.

---

## Variables de entorno

Las credenciales reales no deben quedar hardcodeadas en el código fuente. El proyecto usa archivos `.env` locales y archivos `.env.example` para documentar la configuración requerida.

### Backend

Crear el archivo:

```txt
Deploy/backend_api/.env
```

Base recomendada:

```env
ENVIRONMENT=development

DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
ANTHROPIC_API_KEY=sk-ant-...

JWT_SECRET_KEY=replace_with_a_long_random_secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

HOST=127.0.0.1
PORT=8000

NGROK_TOKEN=
```

### Frontend

Crear el archivo:

```txt
Front/.env
```

Contenido recomendado para desarrollo:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_ENABLE_MOCK_DATA=false
```

Para producción:

```env
VITE_API_BASE_URL=https://api.tu-dominio.cl
VITE_ENABLE_MOCK_DATA=false
```

---

## Instalación local

### 1. Clonar repositorio

```bash
git clone https://github.com/ElChacra/BluegridOCR.git
cd BluegridOCR
```

### 2. Instalar dependencias del backend

```bash
pip install -r Deploy/backend_api/requirements.txt
```

### 3. Instalar dependencias del frontend

```bash
cd Front
npm install
cd ..
```

### 4. Configurar variables de entorno

Crear:

```txt
Deploy/backend_api/.env
Front/.env
```

a partir de los archivos `.env.example` correspondientes.

---

## Ejecución local

### Opción 1: ejecutar todo desde la raíz

```bash
python run.py
```

Salida esperada:

```txt
============================================================
  Sistema listo
============================================================
  Frontend  → http://localhost:5173
  Backend   → http://127.0.0.1:8000
  API docs  → http://127.0.0.1:8000/docs
============================================================
  Ctrl+C para detener todo
```

### Opción 2: ejecutar backend y frontend por separado

Backend:

```bash
cd Deploy/backend_api
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd Front
npm run dev
```

Abrir:

```txt
http://localhost:5173
```

---

## Base de datos y migraciones

BluegridOCR usa PostgreSQL/Supabase como base de datos principal. La conexión debe configurarse usando:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

### Migraciones incluidas

Las migraciones se encuentran en:

```txt
Deploy/backend_api/migrations/
```

| Archivo                                | Descripción                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `001_security_roles_admin.sql`         | Agrega `password_hash`, columnas de estado, roles base y usuario admin inicial. |
| `002_audit_and_traceability.sql`       | Crea tabla de auditoría de eventos.                                             |
| `003_digitalization_user_tracking.sql` | Agrega trazabilidad de usuario a registros OCR.                                 |
| `004_indexes.sql`                      | Agrega índices básicos para login, auditoría y analítica.                       |

### Usuario administrador inicial

La migración inicial crea un usuario administrador si no existe:

| Usuario | Contraseña inicial | Rol     |
| ------- | ------------------ | ------- |
| `admin` | `admin1234`        | `admin` |

La contraseña se guarda como hash bcrypt en la columna `password_hash`.

Hash bcrypt usado por la migración:

```txt
$2y$12$Z/c.TZTylWpevHeETwQwRO1bsdD98FfhnONrhf0MD0mOGCyFKLMT.
```

> Recomendación: cambiar la contraseña del administrador después del primer inicio de sesión.

### Consultas de verificación

Verificar roles:

```sql
SELECT *
FROM roles
WHERE LOWER(nombre_rol) IN ('admin', 'supervisor', 'buzo');
```

Verificar usuario admin:

```sql
SELECT
    u.id_usuario,
    u.username,
    u.nombre_completo,
    u.password_hash IS NOT NULL AS tiene_password_hash,
    u.activo,
    r.nombre_rol
FROM usuarios u
JOIN roles r ON r.id_rol = u.fk_rol
WHERE u.username = 'admin';
```

---

## Autenticación y seguridad

BluegridOCR usa autenticación con JWT.

### Flujo de login

1. El usuario ingresa `username` y `password`.
2. El frontend llama a `POST /api/v1/auth/login`.
3. El backend busca el usuario en PostgreSQL.
4. El backend valida la contraseña con bcrypt.
5. El backend emite un token JWT.
6. El frontend guarda el token.
7. Las siguientes solicitudes privadas incluyen:

```txt
Authorization: Bearer <token>
```

### Contraseñas

Las contraseñas nunca deben guardarse en texto plano.

El backend usa:

```txt
services/security.py
```

para:

* hashear contraseñas al crear usuarios;
* verificar contraseñas al iniciar sesión.

### Autorización por rol

La autorización se aplica desde backend mediante:

```txt
dependencies/auth.py
```

Ejemplo de protección:

```py
current_user: dict = Depends(require_roles(["admin", "supervisor"]))
```

Reglas principales:

| Ruta                                    | Roles permitidos        |
| --------------------------------------- | ----------------------- |
| `POST /api/v1/registros`                | admin, supervisor, buzo |
| `GET /api/v1/dashboard/data`            | admin, supervisor       |
| `GET /api/v1/analytics/buzos`           | admin, supervisor       |
| `POST /api/v1/users`                    | admin                   |
| `PUT /api/v1/registros/{id}/validacion` | admin, supervisor       |
| `GET /api/v1/context/zonas`             | admin, supervisor, buzo |

---

## Endpoints principales

| Método | Ruta                                | Descripción                   | Acceso                  |
| ------ | ----------------------------------- | ----------------------------- | ----------------------- |
| `GET`  | `/api/v1/health`                    | Estado básico de la API       | Público/interno         |
| `GET`  | `/api/v1/ready`                     | Verifica DB, Anthropic y JWT  | Interno                 |
| `POST` | `/api/v1/auth/login`                | Login y emisión de JWT        | Público                 |
| `POST` | `/api/v1/users`                     | Crear usuario                 | admin                   |
| `GET`  | `/api/v1/users`                     | Listar usuarios               | admin                   |
| `POST` | `/api/v1/registros`                 | Subir imagen y procesar OCR   | admin, supervisor, buzo |
| `PUT`  | `/api/v1/registros/{id}/validacion` | Validar registro digitalizado | admin, supervisor       |
| `GET`  | `/api/v1/dashboard/data`            | Datos del dashboard           | admin, supervisor       |
| `GET`  | `/api/v1/context/zonas`             | Zonas o sectores disponibles  | admin, supervisor, buzo |
| `GET`  | `/api/v1/analytics/buzos`           | Métricas agrupadas por buzo   | admin, supervisor       |
| `POST` | `/api/v1/training/feedback`         | Enviar correcciones a dataset | admin, supervisor       |

Documentación interactiva en desarrollo:

```txt
http://localhost:8000/docs
```

En producción, `/docs` y `/redoc` se desactivan cuando:

```env
ENVIRONMENT=production
```

---

## Flujo OCR

El flujo principal de digitalización es:

1. Usuario inicia sesión.
2. El frontend recibe y guarda JWT.
3. Usuario accede al módulo permitido según su rol.
4. Usuario sube una imagen de plantilla.
5. Backend valida tipo y tamaño del archivo.
6. Backend procesa la imagen con Claude Vision.
7. Backend retorna matriz digitalizada.
8. Frontend muestra matriz editable.
9. Usuario corrige los valores si corresponde.
10. Usuario guarda o valida el registro.
11. Backend persiste el resultado en PostgreSQL/Supabase.
12. Dashboard y analíticas consumen la información guardada.

### Validaciones de archivo

El backend debe rechazar archivos inválidos antes de llamar al motor IA.

Parámetros recomendados:

```txt
Tipos permitidos: image/jpeg, image/png, image/webp
Tamaño máximo: 8 MB
```

---

## Deploy con Docker

El proyecto incluye configuración para construir y ejecutar frontend y backend con Docker.

### Levantar stack productivo/staging

Desde la raíz del proyecto:

```bash
docker compose -f docker-compose.prod.yml up --build
```

Servicios esperados:

| Servicio            |  Puerto | Descripción                       |
| ------------------- | ------: | --------------------------------- |
| Frontend            |  `3000` | React compilado servido por Nginx |
| Backend             |  `8000` | API FastAPI                       |
| PostgreSQL/Supabase | Externo | Base administrada                 |

Abrir frontend:

```txt
http://localhost:3000
```

API backend:

```txt
http://localhost:8000
```

Health check:

```txt
http://localhost:8000/api/v1/health
```

Readiness check:

```txt
http://localhost:8000/api/v1/ready
```

### Preparación para Azure Docker

El despliegue en Azure queda soportado con:

| Archivo | Uso |
| ------- | --- |
| `docker-compose.azure.yml` | Compose para Azure con frontend público y backend interno. |
| `Front/nginx.azure.conf` | Nginx sirve React y reenvía `/api/*` al contenedor `backend`. |
| `Front/config.template.js` | Configuración runtime del frontend sin reconstruir la imagen. |
| `Front/docker-entrypoint.d/40-bluegrid-runtime-config.sh` | Genera `config.js` al iniciar el contenedor. |

Flujo recomendado:

```bash
docker build -t <acr>.azurecr.io/bluegridocr-backend:latest ./Deploy/backend_api
docker build -t <acr>.azurecr.io/bluegridocr-frontend:latest ./Front

docker push <acr>.azurecr.io/bluegridocr-backend:latest
docker push <acr>.azurecr.io/bluegridocr-frontend:latest
```

Variables mínimas para Azure:

```env
AZURE_BACKEND_IMAGE=<acr>.azurecr.io/bluegridocr-backend:latest
AZURE_FRONTEND_IMAGE=<acr>.azurecr.io/bluegridocr-frontend:latest

DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET_KEY=replace_with_a_long_random_secret
ALLOWED_ORIGINS=https://tu-app.azurewebsites.net
```

En `docker-compose.azure.yml`, el frontend usa `API_BASE_URL=""` y `ENABLE_INTERNAL_API_PROXY=true`, por lo que el navegador llama a la API por la misma URL pública usando `/api/*`. Azure termina HTTPS en la plataforma, por eso los contenedores quedan en HTTP interno con `HTTPS_ENABLED=false`.

Checks útiles en Azure:

```txt
https://tu-app.azurewebsites.net/healthz
https://tu-app.azurewebsites.net/api/v1/health
https://tu-app.azurewebsites.net/api/v1/ready
```

### Backend Dockerfile

Ubicación:

```txt
Deploy/backend_api/Dockerfile
```

### Frontend Dockerfile

Ubicación:

```txt
Front/Dockerfile
```

### Compose

Ubicación:

```txt
docker-compose.prod.yml
```

---

## Pruebas recomendadas

### Frontend

```bash
cd Front
npm run build
```

### Testing frontend con Jasmine y Karma

El frontend mantiene el testing separado del codigo de aplicacion en `Front/testing/`. La suite usa Jasmine + Karma en navegador. La configuracion esta en:

```txt
Front/testing/karma.conf.cjs
```

Los specs estan en:

```txt
Front/testing/specs/
```

Cobertura actual:

* `services/apiClient.ts`: lectura y limpieza del token, preservacion de opciones de `fetch`, header `Authorization` y header `ngrok-skip-browser-warning`.
* `types.ts`: permisos por rol (`admin`, `supervisor`, `buzo`), restricciones de permisos administrativos, zonas iniciales y contrato inicial del dashboard (`context`, `summary`, `kpis`, `barData`, `lineData`, `mapData`).

Desde Windows/PowerShell se recomienda usar `npm.cmd` para evitar bloqueos de `npm.ps1` por Execution Policy:

```powershell
cd "C:\Users\madzm\OneDrive\Desktop\Proyectos\Denoise\BluegridOCRDUOC\BluegridOCR\Front"
npm.cmd install
npm.cmd run test:karma
```

Comandos equivalentes desde `Front/`:

```powershell
npm.cmd test
npm.cmd run test:karma
```

Modo observador durante desarrollo:

```powershell
npm.cmd run test:karma:watch
```

Ejecucion validada:

```txt
TOTAL: 21 SUCCESS
```

### Backend

```bash
cd Deploy/backend_api
python -m py_compile main.py
```

### Docker

```bash
docker compose -f docker-compose.prod.yml up --build
```

### Pruebas funcionales mínimas

```txt
[ ] /api/v1/health responde correctamente.
[ ] /api/v1/ready valida DB, Anthropic y JWT.
[ ] Login admin funciona con JWT.
[ ] Buzo puede digitalizar.
[ ] Buzo no puede ver dashboard.
[ ] Buzo no puede ver análisis por buzo.
[ ] Supervisor puede ver dashboard.
[ ] Supervisor no puede crear usuarios.
[ ] Admin puede crear usuarios.
[ ] OCR procesa una imagen válida.
[ ] El backend rechaza archivos no permitidos.
[ ] El dashboard no usa datos mock en producción.
```

---

## Buenas prácticas operativas

### Seguridad

* No subir `.env` al repositorio.
* Subir solo `.env.example`.
* Rotar credenciales expuestas o compartidas.
* Usar `JWT_SECRET_KEY` largo y aleatorio.
* Restringir `ALLOWED_ORIGINS` en producción.
* Desactivar Swagger en producción.
* No guardar contraseñas en texto plano.
* No confiar en roles enviados desde frontend.

### Observabilidad

Registrar eventos críticos:

| Evento             | Descripción                    |
| ------------------ | ------------------------------ |
| `login_success`    | Inicio de sesión exitoso       |
| `login_failed`     | Inicio de sesión fallido       |
| `user_created`     | Usuario creado por admin       |
| `ocr_processed`    | Imagen procesada correctamente |
| `matrix_corrected` | Matriz corregida por usuario   |
| `record_validated` | Registro validado              |
| `access_denied`    | Intento de acceso no permitido |
| `claude_error`     | Error del proveedor IA         |
| `db_error`         | Error de base de datos         |

### Producción

Antes de desplegar públicamente:

```txt
[ ] Cambiar contraseña inicial del admin.
[ ] Rotar claves sensibles.
[ ] Configurar dominio real.
[ ] Configurar HTTPS.
[ ] Restringir CORS a dominio real.
[ ] Validar migraciones en staging.
[ ] Probar build frontend.
[ ] Probar Docker Compose.
[ ] Revisar logs.
[ ] Probar subida OCR con imágenes reales.
```

---

## Comandos rápidos

Instalar backend:

```bash
pip install -r Deploy/backend_api/requirements.txt
```

Instalar frontend:

```bash
cd Front
npm install
```

Ejecutar backend:

```bash
cd Deploy/backend_api
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Ejecutar frontend:

```bash
cd Front
npm run dev
```

Build frontend:

```bash
cd Front
npm run build
```

Testing frontend:

```bash
cd Front
npm run test:karma
```

Testing frontend en PowerShell/Windows:

```powershell
cd Front
npm.cmd run test:karma
```

Ejecutar con Docker:

```bash
docker compose -f docker-compose.prod.yml up --build
```

---

## Estado recomendado del proyecto

BluegridOCR debe mantenerse bajo la siguiente regla:

```txt
MVP funcional + seguridad base + despliegue reproducible
```

El foco principal no es solo digitalizar imágenes, sino asegurar trazabilidad, control de acceso, estabilidad operativa y una base preparada para escalar hacia más analítica, auditoría y entrenamiento asistido por correcciones humanas.
