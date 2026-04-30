# BluegridOCR

Repositorio de entrega del proyecto **BluegridOCR**, sistema web para digitalizar planillas acuícolas mediante visión artificial. El proyecto permite subir imágenes de tablillas o plantillas de campo, procesarlas con Claude Vision, extraer una matriz estructurada de datos, corregir resultados manualmente y guardar los registros en PostgreSQL/Supabase para trazabilidad, dashboard operativo y análisis por usuario.

---

## Tabla de contenidos

* [Descripción general](#descripción-general)
* [Objetivo del proyecto](#objetivo-del-proyecto)
* [Estructura del repositorio de entrega](#estructura-del-repositorio-de-entrega)
* [Estructura técnica del producto](#estructura-técnica-del-producto)
* [Stack tecnológico](#stack-tecnológico)
* [Roles y permisos](#roles-y-permisos)
* [Flujo funcional del sistema](#flujo-funcional-del-sistema)
* [Variables de entorno](#variables-de-entorno)
* [Instalación local](#instalación-local)
* [Ejecución local](#ejecución-local)
* [Base de datos y migraciones](#base-de-datos-y-migraciones)
* [Autenticación y seguridad](#autenticación-y-seguridad)
* [Endpoints principales](#endpoints-principales)
* [Deploy con Docker](#deploy-con-docker)
* [Pruebas recomendadas](#pruebas-recomendadas)
* [Contenido por carpeta](#contenido-por-carpeta)
* [Buenas prácticas operativas](#buenas-prácticas-operativas)
* [Estado del proyecto](#estado-del-proyecto)

---

## Descripción general

BluegridOCR nace como una solución para apoyar la digitalización de registros acuícolas escritos manualmente en terreno. En el contexto operativo, buzos o personal de campo pueden completar planillas o tablillas físicas con información relevante. Luego, el sistema permite fotografiar esas plantillas, procesarlas con visión artificial y transformar la información visual en datos estructurados.

El sistema no busca reemplazar completamente la revisión humana, sino acelerar el proceso de extracción y reducir errores de transcripción mediante un flujo semi-automatizado:

1. El usuario sube una imagen.
2. El backend procesa la imagen con Claude Vision.
3. El sistema genera una matriz digitalizada.
4. El usuario revisa y corrige los datos.
5. El registro se guarda en base de datos.
6. La información queda disponible para dashboard, trazabilidad y análisis.

---

## Objetivo del proyecto

El objetivo principal de BluegridOCR es reducir la carga manual asociada a la lectura, transcripción y consolidación de planillas acuícolas, entregando un sistema que permita:

* Digitalizar datos de terreno desde imágenes.
* Estandarizar la captura de información.
* Reducir errores humanos de transcripción.
* Guardar registros estructurados en una base de datos.
* Consultar datos mediante dashboard operativo.
* Analizar actividad por usuario o buzo.
* Mantener trazabilidad sobre quién digitaliza, corrige o valida información.

---

## Estructura del repositorio de entrega

La estructura del repositorio está organizada según los apartados solicitados para la entrega del proyecto:

```txt
BluegridOCR/
├── README.md
│
├── Documentacion/
│   ├── Informe/
│   ├── UML/
│   ├── Wireframe/
│   ├── MER/
│   └── Gantt/
│
├── Producto/
│   ├── CodigoFuente/
│   │   ├── Front/
│   │   ├── Deploy/
│   │   ├── run.py
│   │   ├── docker-compose.prod.yml
│   │   └── README_TECNICO.md
│   │
│   ├── Scripts_BD/
│   ├── Librerias/
│   └── Datos_Prueba/
│
└── Gestion/
    ├── Integrantes.txt
    └── README_Gestion.md
```

---

## Estructura técnica del producto

El código fuente principal se encuentra en:

```txt
Producto/CodigoFuente/
```

Estructura técnica esperada del producto:

```txt
Producto/CodigoFuente/
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

### Inteligencia artificial / OCR

* Claude Vision
* Procesamiento de imagen en backend
* Extracción de matriz estructurada
* Corrección humana posterior a la inferencia

### Despliegue

* Docker
* Docker Compose
* Nginx para servir frontend compilado

---

## Roles y permisos

BluegridOCR contempla tres roles principales.

| Rol          | Descripción                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------- |
| `admin`      | Administrador general. Tiene acceso total al sistema.                                       |
| `supervisor` | Usuario de supervisión. Puede digitalizar, revisar dashboard y analizar actividad por buzo. |
| `buzo`       | Usuario operativo. Solo puede digitalizar plantillas.                                       |

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

La seguridad debe aplicarse en backend mediante JWT y validación por rol. El frontend solo debe ocultar o mostrar módulos según permisos para mejorar la experiencia de usuario.

---

## Flujo funcional del sistema

El flujo principal de uso es:

1. El usuario inicia sesión.
2. El backend valida credenciales y entrega un token JWT.
3. El frontend guarda el token y lo envía en las siguientes solicitudes.
4. El usuario accede a los módulos permitidos según su rol.
5. El usuario sube una imagen de plantilla o tablilla.
6. El backend valida tipo y tamaño del archivo.
7. El backend procesa la imagen usando Claude Vision.
8. El sistema retorna una matriz digitalizada.
9. El usuario revisa y corrige los datos si es necesario.
10. El registro se guarda en PostgreSQL/Supabase.
11. El dashboard y los módulos analíticos consumen la información almacenada.

---

## Variables de entorno

Las credenciales reales no deben quedar hardcodeadas en el código fuente. El proyecto usa archivos `.env` locales y archivos `.env.example` para documentar la configuración requerida.

### Backend

Crear archivo:

```txt
Producto/CodigoFuente/Deploy/backend_api/.env
```

Contenido base:

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

Crear archivo:

```txt
Producto/CodigoFuente/Front/.env
```

Contenido para desarrollo:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_ENABLE_MOCK_DATA=false
```

Contenido para producción:

```env
VITE_API_BASE_URL=https://api.tu-dominio.cl
VITE_ENABLE_MOCK_DATA=false
```

---

## Instalación local

### 1. Clonar repositorio

```bash
git clone https://github.com/ManuelADMN/BluegridOCR.git
cd BluegridOCR
```

### 2. Entrar al código fuente

```bash
cd Producto/CodigoFuente
```

### 3. Instalar dependencias del backend

```bash
pip install -r Deploy/backend_api/requirements.txt
```

### 4. Instalar dependencias del frontend

```bash
cd Front
npm install
cd ..
```

### 5. Configurar variables de entorno

Crear los archivos:

```txt
Deploy/backend_api/.env
Front/.env
```

usando como base los `.env.example` correspondientes.

---

## Ejecución local

Desde:

```bash
cd Producto/CodigoFuente
```

Ejecutar todo el sistema:

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

### Ejecutar backend por separado

```bash
cd Producto/CodigoFuente/Deploy/backend_api
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Ejecutar frontend por separado

```bash
cd Producto/CodigoFuente/Front
npm run dev
```

Abrir:

```txt
http://localhost:5173
```

---

## Base de datos y migraciones

BluegridOCR usa PostgreSQL/Supabase como base de datos principal. La conexión se configura mediante:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

### Migraciones esperadas

Ubicación:

```txt
Producto/CodigoFuente/Deploy/backend_api/migrations/
```

| Archivo                                | Descripción                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `001_security_roles_admin.sql`         | Agrega `password_hash`, columnas de estado, roles base y usuario admin inicial. |
| `002_audit_and_traceability.sql`       | Crea tabla de auditoría de eventos.                                             |
| `003_digitalization_user_tracking.sql` | Agrega trazabilidad de usuario a registros OCR.                                 |
| `004_indexes.sql`                      | Agrega índices básicos para login, auditoría y analítica.                       |

### Usuario administrador inicial

| Usuario | Contraseña inicial | Rol     |
| ------- | ------------------ | ------- |
| `admin` | `admin1234`        | `admin` |

La contraseña debe almacenarse solo como hash bcrypt en la columna `password_hash`.

Hash bcrypt de referencia:

```txt
$2y$12$Z/c.TZTylWpevHeETwQwRO1bsdD98FfhnONrhf0MD0mOGCyFKLMT.
```

### Verificar roles

```sql
SELECT *
FROM roles
WHERE LOWER(nombre_rol) IN ('admin', 'supervisor', 'buzo');
```

### Verificar usuario admin

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

BluegridOCR debe usar autenticación con JWT.

### Flujo de login

1. El usuario ingresa `username` y `password`.
2. El frontend llama a `POST /api/v1/auth/login`.
3. El backend busca el usuario en PostgreSQL.
4. El backend valida la contraseña usando bcrypt.
5. El backend emite un JWT.
6. El frontend guarda el token.
7. Las solicitudes privadas envían:

```txt
Authorization: Bearer <token>
```

### Contraseñas

Las contraseñas nunca deben guardarse en texto plano. El backend debe usar:

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

Ejemplo:

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

En producción, `/docs` y `/redoc` deben desactivarse usando:

```env
ENVIRONMENT=production
```

---

## Deploy con Docker

Desde:

```bash
cd Producto/CodigoFuente
```

levantar el stack:

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

---

## Pruebas recomendadas

### Frontend

```bash
cd Producto/CodigoFuente/Front
npm run build
```

### Backend

```bash
cd Producto/CodigoFuente/Deploy/backend_api
python -m py_compile main.py
```

### Docker

```bash
cd Producto/CodigoFuente
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

## Contenido por carpeta

### Documentacion

Carpeta destinada a documentación formal del proyecto.

```txt
Documentacion/
├── Informe/
├── UML/
├── Wireframe/
├── MER/
└── Gantt/
```

Contenido esperado:

* Informe del proyecto.
* Diagramas UML.
* Wireframes.
* Modelo Entidad Relación.
* Carta Gantt.
* Otros documentos de análisis, diseño o QA.

### Producto

Carpeta destinada a los entregables técnicos.

```txt
Producto/
├── CodigoFuente/
├── Scripts_BD/
├── Librerias/
└── Datos_Prueba/
```

Contenido esperado:

* Código fuente.
* Scripts SQL.
* Librerías o referencias técnicas.
* Datos de prueba.

### Gestion

Carpeta destinada a documentos administrativos.

```txt
Gestion/
├── Integrantes.txt
└── README_Gestion.md
```

Contenido esperado:

* Documento de registro de definición e identificación del proyecto.
* Archivo de integrantes.
* Documentación administrativa complementaria.

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

### Validación de archivos OCR

El backend debe rechazar archivos inválidos antes de llamar al motor IA.

Parámetros recomendados:

```txt
Tipos permitidos: image/jpeg, image/png, image/webp
Tamaño máximo: 8 MB
```

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

---

## Estado del proyecto

BluegridOCR debe mantenerse bajo la siguiente regla:

```txt
MVP funcional + seguridad base + despliegue reproducible
```

El foco principal no es solo digitalizar imágenes, sino asegurar trazabilidad, control de acceso, estabilidad operativa y una base preparada para escalar hacia más analítica, auditoría y entrenamiento asistido por correcciones humanas.
