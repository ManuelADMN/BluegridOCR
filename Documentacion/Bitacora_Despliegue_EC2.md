# Bitacora de despliegue y mejoras - BluegridOCR en EC2

Resumen consolidado del trabajo de despliegue en AWS EC2 (AWS Academy) y de las mejoras aplicadas. Este documento reemplaza logs granulares de trabajo sobre storage de imagenes, fix de login, acceso publico y fixes de administracion.

## Arquitectura desplegada

- Docker Compose en EC2 con Amazon Linux 2023.
- Backend FastAPI y frontend React/Nginx.
- Base de datos PostgreSQL gestionada en Supabase.
- OCR mediante Claude Vision por API Anthropic.
- Imagenes persistidas en disco de la instancia.
- Acceso por frontend: `http://<host-ec2>:3000`.

La URL publica de la instancia cambia en cada stop/start si no se usa Elastic IP.

## 1. Persistencia de imagenes en la instancia

Se reemplazo el uso de Blob Storage externo por almacenamiento en filesystem dentro de la EC2.

- Ruta host: `/opt/bluegridocr/data`.
- Ruta contenedor: `/data`.
- Esquema de archivos: `registros/{id_registro}/original.jpg` y `warped.png`.
- Backend: `services/storage.py`.
- Endpoint: `GET /api/v1/registros/{id}/imagen`.
- Control de acceso: `admin` y `supervisor` reciben 200; `buzo` recibe 403.

Validacion reportada en EC2:

- Registro de prueba persistido en disco.
- `admin` y `supervisor`: 200.
- `buzo`: 403.
- Tests offline asociados: 9.

## 2. Fix de login: "Base de datos no disponible"

El mensaje visible indicaba "Base de datos no disponible", pero la causa real no era Supabase. El endpoint `/ready` respondia correctamente. El fallo estaba en bcrypt:

- `passlib==1.7.4` no era compatible con `bcrypt==5.0.0`.
- `verify_password()` fallaba y el backend envolvia la excepcion como 503.

Correccion aplicada:

- `bcrypt==4.0.1` fijado en `requirements.txt`.
- Imagen Docker reconstruida.
- Login admin validado con HTTP 200.

## 3. Acceso publico con proxy interno

Problema detectado: el frontend apuntaba a un host/IP antiguo en `:8000` despues de un stop/start de EC2.

Solucion aplicada:

- Se habilito proxy interno de Nginx.
- `ENABLE_INTERNAL_API_PROXY=true`.
- `nginx.azure.conf` proxy: `/api/` hacia `backend:8000` por la red interna de Docker.
- `API_BASE_URL=""`.

Resultado:

- Solo se expone el puerto 3000.
- El backend no necesita quedar expuesto publicamente.
- Sin CORS entre frontend y backend.
- El frontend queda independiente del cambio de IP publica de la instancia.

Validacion reportada:

- Login admin OK.
- Llamadas API same-origin: `:3000/api/v1/*`.
- Sin llamadas al host antiguo.
- Sin requests fallidos en Playwright.

## 4. Paneles de administracion y rechazo

Cambios aplicados:

- Boton "Actualizar" en panel admin con spinner y toast "Datos actualizados".
- Edicion de embarcaciones con `PATCH /context/embarcaciones/{id}` solo para admin.
- Boton "Editar" por fila y campo `Estado` en formulario.
- Motivo de rechazo limitado a 200 caracteres en frontend y backend.
- Backend valida con `Field(max_length=200)` y responde 422 si excede.

Validacion reportada en EC2:

- `PATCH /context/embarcaciones/{id}` como admin: 200.
- Mismo PATCH como supervisor: 403.
- Rechazo con 201 caracteres: 422.
- Rechazo vacio: 422.
- UI muestra toast de actualizacion y formulario "Actualizar embarcacion".
- Tests offline reportados: 22 passed.

## Procedimiento de despliegue resumido

```bash
cd /opt/bluegridocr/repo
git pull origin develop
mkdir -p /opt/bluegridocr/data
sudo docker compose -f docker-compose.prod.yml up -d --build
curl -i http://localhost:3000/api/v1/health
```

Security Group recomendado:

- TCP 3000 inbound desde la IP autorizada.
- TCP 22 inbound solo desde la IP autorizada.

El archivo `.env` debe permanecer fuera de Git. Contiene `DATABASE_URL`, `ANTHROPIC_API_KEY`, `JWT_SECRET_KEY` y `API_BASE_URL=`.

## Recomendacion de seguridad

Antes de una entrega publica, rotar la clave de Anthropic y las credenciales de base de datos/admin que hayan sido usadas durante desarrollo o documentacion interna.
