# Solución: quitar el `:3000` y habilitar HTTPS

## Diagnóstico

El frontend se publicaba en el **puerto 3000** del host (`"3000:80"` en el compose) y **nada
escuchaba en 80 ni 443**, sin certificado TLS. Por eso:

- **Siempre entrabas con `:3000`**: el navegador asume el puerto 80 para `http://`, y ahí no
  había nadie.
- **No había HTTPS**: no existía listener en 443 ni certificado.

Además, el sondeo mostró que los puertos **80 y 443 no responden nada** desde fuera, lo que
indica que el **Security Group de la EC2 probablemente solo tiene abierto el 3000** (y el 22).

---

## Lo que cambié en el repo

| Archivo | Cambio |
|---|---|
| `docker-compose.prod.yml` (raíz) | El frontend ahora se publica en el **puerto 80** (`${FRONTEND_PORT:-80}:80`). Fin del `:3000`. |
| `Producto/CodigoFuente/Front/nginx.https.conf` | Reescrito: TLS en 443, redirect 80→443, y —clave— **incluye el proxy interno `/api`** y `client_max_body_size 20m` (sin esto se rompían login y subida de imágenes). |
| `docker-compose.https.yml` (raíz, nuevo) | Stack HTTPS completo (Opción B): TLS en 80/443, backend interno, `ENABLE_INTERNAL_API_PROXY=false` para que el entrypoint no pise la conf. |
| `scripts/gen-selfsigned-cert.sh` (nuevo) | Genera un certificado autofirmado para demo/entrega. |

> Estos cambios son de configuración en el repo. **Lo que debes ejecutar tú en la EC2/AWS**
> (abrir puertos y generar certificados) se detalla abajo — yo no toco tu infraestructura.

---

## Paso 1 — Quitar el `:3000` (HTTP en el puerto 80)

1. **Abre el puerto 80/TCP** en el Security Group de la EC2 (Inbound rules → HTTP, 0.0.0.0/0).
2. En la EC2, redepliega:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
3. Ya funciona sin puerto: **http://ec2-34-235-152-207.compute-1.amazonaws.com**

Con esto solucionas el `:3000`. Si prefieres HTTPS, sigue al paso 2 (y puedes omitir este).

---

## Paso 2 — HTTPS

TLS necesita un **certificado** y los **puertos 80 y 443 abiertos** en el Security Group. Hay
dos caminos:

### Opción A — Certificado autofirmado (rápido, para la entrega/demo)
Funciona con la IP/DNS de AWS, pero el navegador mostrará una advertencia de "sitio no seguro"
(normal en autofirmados; se acepta y entra).

```bash
# En la EC2, dentro del repo:
bash scripts/gen-selfsigned-cert.sh ec2-34-235-152-207.compute-1.amazonaws.com
docker compose -f docker-compose.https.yml up -d --build
```
→ **https://ec2-34-235-152-207.compute-1.amazonaws.com** (con aviso del navegador).

### Opción B — Certificado válido con dominio propio (producción)
**No se puede** emitir un certificado válido para `ec2-...amazonaws.com` (ese dominio es de AWS,
no tuyo). Necesitas un dominio propio:

1. Registra/usa un dominio y crea un registro **A** apuntando a `34.235.152.207`.
2. Abre **80 y 443** en el Security Group.
3. Emite el certificado con Let's Encrypt (ejemplo con certbot en la EC2):
   ```bash
   sudo certbot certonly --standalone -d tudominio.cl
   sudo cp /etc/letsencrypt/live/tudominio.cl/fullchain.pem certs/prod/fullchain.pem
   sudo cp /etc/letsencrypt/live/tudominio.cl/privkey.pem   certs/prod/privkey.pem
   ```
   (Debe estar libre el puerto 80 al correr certbot; detén el stack o usa el plugin webroot.)
4. Levanta el stack HTTPS:
   ```bash
   docker compose -f docker-compose.https.yml up -d --build
   ```
   → **https://tudominio.cl** sin puerto, con candado válido. Recuerda renovar el cert (certbot
   renueva y basta con recargar/reiniciar el contenedor frontend).

---

## Resumen de puertos del Security Group

| Puerto | Para qué | Cuándo |
|---|---|---|
| 22 | SSH | siempre (idealmente restringido a tu IP) |
| 80 | HTTP / redirect a HTTPS | Paso 1 y Paso 2 |
| 443 | HTTPS | Paso 2 |
| 3000 | (ya no hace falta) | puedes cerrarlo tras el Paso 1 |
