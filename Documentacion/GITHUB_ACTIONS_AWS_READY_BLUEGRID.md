# GitHub Actions + AWS Ready BluegridOCR

## 1. Flujo real detectado del sistema

```text
Usuario
  -> Frontend React/Vite
     Ruta: Producto/CodigoFuente/Front
     Dev: npm run dev
     Build: npm run build
     Test: npm run test
     Docker: Producto/CodigoFuente/Front/Dockerfile
     Runtime Docker: Nginx, puerto interno 80, puerto host prod 3000
  -> Backend API FastAPI
     Ruta: Producto/CodigoFuente/Deploy/backend_api
     Run: python run_server.py
     Docker: Producto/CodigoFuente/Deploy/backend_api/Dockerfile
     Puerto: 8000
     Health: /api/v1/health
     Ready: /api/v1/ready
  -> OCR / IA
     Servicio: Producto/CodigoFuente/Deploy/backend_api/services/motor_ia.py
     Motor IA: Anthropic Claude via ANTHROPIC_API_KEY
     Modo actual por defecto: OCR_MODE=segmented
  -> Base de datos
     PostgreSQL/Supabase via DATABASE_URL
     Servicio: Producto/CodigoFuente/Deploy/backend_api/services/db.py
  -> Resultado estructurado
     Endpoint principal OCR: POST /api/v1/registros
     Persistencia: registros_ocr y detalle asociado
     Exportaciones/reportes: routers reports/dashboard/supervision
```

## Instalacion y build frontend

```bash
cd Producto/CodigoFuente/Front
npm install
npm run build
npm run test
```

Evidencia local: `Documentation/evidencias/local_validation.log`.

Estado detectado:

- `npm install`: CUMPLE.
- `npm run build`: CUMPLE.
- `npm run test`: CUMPLE, 21 tests exitosos.
- Observacion: npm reporto 9 vulnerabilidades. Revisar con `npm audit`.
- Observacion: Vite reporto chunk JS mayor a 500 kB; no bloquea build.

## Instalacion y test backend

```bash
cd Producto/CodigoFuente/Deploy/backend_api
python --version
python -m pip install -r requirements.txt
python -m pytest -q
```

Evidencia local: `Documentation/evidencias/local_validation.log`.

Estado detectado:

- Python local: 3.13.12.
- Dependencias: CUMPLE.
- Tests backend: CUMPLE, 10 tests exitosos.
- CI usa Python 3.11 para alinearse con Dockerfile `python:3.11-slim`.

## Docker

Dockerfiles detectados:

- Frontend: `Producto/CodigoFuente/Front/Dockerfile`.
- Backend: `Producto/CodigoFuente/Deploy/backend_api/Dockerfile`.

Compose existentes:

- `Producto/CodigoFuente/docker-compose.prod.yml`.
- `Producto/CodigoFuente/docker-compose.azure.yml`.
- `Producto/CodigoFuente/docker-compose.https.yml`.

Compose creado en raiz:

- `docker-compose.prod.yml`.

Validacion:

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=150
docker compose -f docker-compose.prod.yml down
```

Estado local:

- `docker compose config`: CUMPLE.
- `docker compose build`: NO CUMPLE localmente porque Docker daemon no esta disponible (`dockerDesktopLinuxEngine`).
- `up/ps/logs/down`: PENDIENTE local por daemon Docker no disponible.

Evidencia: `Documentation/evidencias/docker_validation.log`.

## Servicios externos y variables obligatorias

Backend:

- `ENVIRONMENT`
- `DATABASE_URL`
- `APP_TIMEZONE`
- `SUPABASE_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `ANTHROPIC_OCR_AUDIT_MODEL`
- `OCR_MODE`
- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `ALLOWED_ORIGINS`
- `HOST`
- `PORT`
- `HTTPS_ENABLED`
- `SSL_CERTFILE`
- `SSL_KEYFILE`

Frontend:

- `VITE_API_BASE_URL`
- `VITE_ENABLE_MOCK_DATA`
- `VITE_HTTPS`
- `VITE_SSL_CERTFILE`
- `VITE_SSL_KEYFILE`
- `API_BASE_URL`

AWS GitHub Actions:

- `AWS_REGION`
- `AWS_ROLE_ARN`
- `ECR_REPOSITORY`

No se deben crear ni usar:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## Workflows creados

### `.github/workflows/ci-bluegrid.yml`

Ejecuta:

- Checkout.
- Deteccion de rutas reales.
- Instalacion frontend con `npm ci`.
- Tests frontend.
- Build frontend.
- Instalacion backend.
- Tests backend.
- `docker compose config`.
- `docker compose build`.
- Resumen en GitHub Actions Summary.

No requiere AWS.

### `.github/workflows/aws-ecr-ready.yml`

Ejecuta:

- Checkout.
- Validacion de variables `AWS_REGION`, `AWS_ROLE_ARN`, `ECR_REPOSITORY`.
- Autenticacion AWS con OIDC.
- `aws sts get-caller-identity`.
- Creacion/verificacion de ECR.
- Login a ECR.
- Build y push de imagen backend.
- Build y push de imagen frontend.
- Resumen de imagenes.

Si AWS no esta configurado, falla con mensaje claro.

## Scripts creados

- `scripts/check_health.sh`
- `scripts/build_local.sh`
- `scripts/docker_validate.sh`
- `scripts/aws_preflight_check.sh`

## Pendientes

- Configurar OIDC Provider en AWS Student.
- Crear IAM Role restringido al repo/rama.
- Crear o permitir creacion de ECR.
- Agregar variables GitHub Actions.
- Ejecutar `aws-ecr-ready.yml`.
- Definir despliegue posterior: EC2 + Docker Compose, ECS Fargate o App Runner.
