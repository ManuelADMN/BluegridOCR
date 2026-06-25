# BluegridOCR — Configuración de servidor y despliegue

---

## 3.9. Configuración de servidor y despliegue

La configuración de servidor de BluegridOCR se basa en una arquitectura full-stack desacoplada y preparada para ejecución mediante contenedores Docker. Esta decisión permite reproducir el entorno en distintos equipos o servidores, reduciendo errores de configuración manual y manteniendo coherencia entre desarrollo, pruebas y producción.

El backend se ejecuta con Python, FastAPI y Uvicorn. El frontend se construye con React y Vite. La persistencia se gestiona mediante PostgreSQL/Supabase. Las credenciales, secretos JWT, claves de API y URLs de conexión se administran mediante variables de entorno.

---

## Stack tecnológico instalado (verificado 2026-05-28)

| Componente | Tecnología | Versión verificada |
|---|---|---|
| Backend lenguaje | Python | 3.13.12 |
| Backend framework | FastAPI | Última estable |
| Backend servidor | Uvicorn | Con `--reload` en dev |
| Frontend framework | React + TypeScript | Vite 6+ |
| Frontend build | Vite | Node 24.14.0 |
| Gestión de paquetes JS | npm | 11.2.0 |
| Base de datos | PostgreSQL | Supabase administrado |
| Contenedores | Docker + Docker Compose | Disponible |
| Reverse proxy (producción) | Nginx | Incluido en Dockerfile frontend |
| IA/OCR | Claude Vision (Anthropic) | claude-sonnet-4-6 |

---

## Estructura de archivos de configuración

```
BluegridOCR/Producto/CodigoFuente/
├── run.py                           ← Arranca backend + frontend en desarrollo
├── docker-compose.prod.yml          ← Stack completo producción/staging
├── docker-compose.azure.yml         ← Configuración Azure Web Apps
├── docker-compose.https.yml         ← Stack con HTTPS local
│
├── Front/
│   ├── Dockerfile                   ← Build React + Nginx
│   ├── nginx.conf                   ← Reverse proxy producción
│   ├── nginx.azure.conf             ← Nginx para Azure (proxy /api/*)
│   ├── .env.example                 ← Variables de entorno frontend
│   └── vite.config.ts               ← Configuración de build
│
└── Deploy/
    └── backend_api/
        ├── Dockerfile               ← Build Python/FastAPI
        ├── .dockerignore
        ├── .env.example             ← Variables de entorno backend
        ├── requirements.txt         ← Dependencias Python
        ├── main.py                  ← Entry point FastAPI
        └── run_server.py            ← Script de arranque manual
```

---

## 3.9.1 Variables de entorno

BluegridOCR utiliza variables de entorno para separar configuración sensible del código fuente. El repositorio incluye `.env.example` sin secretos reales.

### Backend (`.env.example`)

```env
ENVIRONMENT=production

DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
APP_TIMEZONE=America/Santiago

ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_OCR_AUDIT_MODEL=claude-sonnet-4-6

JWT_SECRET_KEY=change-me-use-a-long-random-string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

ALLOWED_ORIGINS=https://dominio.cl,http://localhost:5173

HOST=0.0.0.0
PORT=8000
HTTPS_ENABLED=false
```

### Frontend (`.env.example`)

```env
VITE_API_BASE_URL=https://api.dominio.cl
VITE_ENABLE_MOCK_DATA=false
```

> **Seguridad:** el archivo `.env` real no se sube al repositorio (está en `.gitignore`). Las credenciales reales se configuran en el entorno de despliegue o plataforma cloud.

---

## Comandos de instalación y ejecución

### Instalación local

```bash
# Dependencias backend
pip install -r Producto/CodigoFuente/Deploy/backend_api/requirements.txt

# Dependencias frontend
cd Producto/CodigoFuente/Front
npm install
```

### Ejecución local (desarrollo)

```bash
# Opción 1: script unificado
cd Producto/CodigoFuente
python run.py
```

Salida esperada:
```
============================================================
  Sistema listo
============================================================
  Frontend  → http://localhost:5173
  Backend   → http://127.0.0.1:8000
  API docs  → http://127.0.0.1:8000/docs
============================================================
```

```bash
# Opción 2: por separado
# Backend
cd Deploy/backend_api
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Frontend
cd Front
npm run dev
```

### Ejecución con Docker

```bash
# Levantar stack completo
docker compose -f docker-compose.prod.yml up -d --build

# Verificar estado
docker compose -f docker-compose.prod.yml ps

# Ver logs del backend
docker compose -f docker-compose.prod.yml logs -f backend

# Ver logs del frontend
docker compose -f docker-compose.prod.yml logs -f frontend

# Detener
docker compose -f docker-compose.prod.yml down
```

Servicios esperados:

| Servicio | Puerto | Descripción |
|---|---|---|
| Frontend | 3000 | React compilado servido por Nginx |
| Backend | 8000 | API FastAPI con Uvicorn |
| PostgreSQL/Supabase | externo | Base administrada |

---

## Verificación post-despliegue

```bash
# Estado básico
curl http://localhost:8000/api/v1/health

# Verificar DB, Anthropic y JWT
curl http://localhost:8000/api/v1/ready

# Swagger interactivo (solo en desarrollo)
http://localhost:8000/docs
```

Respuestas esperadas:
```json
# /health
{ "status": "ok", "service": "BluegridOCR API", "environment": "development" }

# /ready
{ "status": "ready", "checks": { "database": true, "anthropic_key": true, "jwt_secret": true } }
```

---

## Despliegue en Azure (preparado)

El repositorio incluye `docker-compose.azure.yml` y `nginx.azure.conf` para despliegue en Azure Web Apps:

```bash
# Build y push de imágenes
docker build -t <acr>.azurecr.io/bluegridocr-backend:latest ./Deploy/backend_api
docker build -t <acr>.azurecr.io/bluegridocr-frontend:latest ./Front

docker push <acr>.azurecr.io/bluegridocr-backend:latest
docker push <acr>.azurecr.io/bluegridocr-frontend:latest
```

Health checks en Azure:
```
https://tu-app.azurewebsites.net/api/v1/health
https://tu-app.azurewebsites.net/api/v1/ready
```

---

## Dependencias Python (requirements.txt)

```
fastapi
uvicorn[standard]
psycopg2-binary
python-dotenv
passlib[bcrypt]
python-jose[cryptography]
anthropic
python-multipart
requests
```

---

## Compilación verificada

```bash
python -m py_compile main.py
# Exit code: 0 (sin errores de sintaxis)
```

Resultado: **OK** — el backend compila sin errores.
