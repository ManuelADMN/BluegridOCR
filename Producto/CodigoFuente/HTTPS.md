# HTTPS en BluegridOCR

## Desarrollo local

1. Generar certificado local:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\generate-dev-cert.ps1
```

2. Activar HTTPS en `Deploy/backend_api/.env`:

```env
HTTPS_ENABLED=true
SSL_CERTFILE=../../certs/dev/bluegridocr.local.pem
SSL_KEYFILE=../../certs/dev/bluegridocr.local.key
ALLOWED_ORIGINS=https://localhost:5173,https://localhost:5174,http://localhost:5173,http://localhost:5174,http://localhost:3000,https://localhost:3000
```

3. Levantar con el runner del proyecto:

```powershell
python run.py
```

El frontend recibe automaticamente `VITE_API_BASE_URL=https://localhost:8000` cuando `HTTPS_ENABLED=true`.
El navegador puede mostrar advertencia porque es un certificado local autofirmado.

## Produccion con Docker

Colocar certificados reales en:

```text
certs/prod/fullchain.pem
certs/prod/privkey.pem
```

Levantar con:

```powershell
docker compose -f docker-compose.prod.yml -f docker-compose.https.yml up --build
```

El frontend queda publicado en `https://localhost:3000` y el backend en `https://localhost:8000`.
