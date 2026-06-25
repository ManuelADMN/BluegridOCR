# BluegridOCR — Configuración del ambiente de pruebas

---

## 3.8. Configuración del ambiente de pruebas

Para asegurar que el producto pueda ser validado de forma controlada, BluegridOCR considera un ambiente de pruebas orientado a replicar la configuración del entorno de producción. Este ambiente permite ejecutar pruebas funcionales, operativas, de integración, validación y verificación sin afectar datos definitivos.

El ambiente de pruebas conserva la misma separación lógica de producción: frontend web, backend API, base de datos PostgreSQL/Supabase, integración con Claude Vision y variables de entorno independientes.

---

## Ambientes definidos

| Ambiente | Propósito | Base de datos | Variables | Frontend | Backend |
|---|---|---|---|---|---|
| Desarrollo | Trabajo local del equipo | Supabase dev o local | `.env` local | `npm run dev` (Vite) | `uvicorn --reload` |
| Pruebas/Staging | Validación previa a entrega | Supabase test | `.env.test` | Build Vite | `uvicorn` |
| Producción | Operación final proyectada | Supabase prod | Variables cloud | Build + Nginx | Uvicorn + Docker |

---

## Servicios que se levantan en el ambiente de pruebas

| Servicio | Tecnología | Puerto | Descripción |
|---|---|---|---|
| Frontend web | React + Vite | 5173 (dev) / 3000 (Docker) | Interfaz de usuario |
| Backend API | FastAPI + Uvicorn | 8000 | API REST con JWT y RBAC |
| Base de datos | PostgreSQL/Supabase | externo | Persistencia de datos |
| Motor IA/OCR | Claude Vision API | externo (Anthropic) | Procesamiento multimodal |

---

## Paridad entre ambiente de pruebas y producción

| Característica | Pruebas/Staging | Producción | ¿Paridad? |
|---|---|---|---|
| Stack tecnológico | Python/FastAPI/React | Python/FastAPI/React | ✅ |
| Motor IA | Claude Vision (claude-sonnet-4-6) | Claude Vision (claude-sonnet-4-6) | ✅ |
| Base de datos | PostgreSQL/Supabase | PostgreSQL/Supabase | ✅ |
| Autenticación JWT | Sí | Sí | ✅ |
| Control de acceso RBAC | Sí | Sí | ✅ |
| Endpoints disponibles | 22 endpoints | 22 endpoints | ✅ |
| Docker | Disponible | docker-compose.prod.yml | ✅ |
| Secretos reales | No (variables locales) | Sí (plataforma cloud) | Diferencia esperada |
| Swagger UI | Habilitado (ENVIRONMENT=development) | Deshabilitado (ENVIRONMENT=production) | Diferencia esperada |

---

## Verificación de componentes en ambiente de pruebas

### Verificación de conexión a base de datos

```bash
curl http://127.0.0.1:8000/api/v1/ready
```

Resultado capturado (2026-05-28):
```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "anthropic_key": true,
    "jwt_secret": true
  },
  "anthropic_model": "claude-sonnet-4-6"
}
```

### Verificación de Claude Vision/API Key

Confirmado por `anthropic_key: true` en `/ready`. Modelo activo: `claude-sonnet-4-6`.

### Verificación de JWT

Confirmado por `jwt_secret: true` en `/ready`. Algoritmo: HS256, expiración: 480 minutos.

---

## Cómo levantar el ambiente de pruebas

### Opción 1: local (más rápido para pruebas)

```bash
cd Producto/CodigoFuente
python run.py
```

Resultado esperado:
```
✅ ANTHROPIC_API_KEY detectada.
✅ Backend listo en http://127.0.0.1:8000
  Frontend  → http://localhost:5173
  Backend   → http://127.0.0.1:8000
  API docs  → http://127.0.0.1:8000/docs
```

### Opción 2: Docker (más cercano a producción)

```bash
cd Producto/CodigoFuente
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

---

## Script de generación de evidencias de pruebas

Para regenerar la batería de evidencias automáticamente:

```bash
python Evidencias_Testing/scripts/generar_evidencias_testing.py
```

El script realiza automáticamente:
1. Prueba de `/health` y `/ready`
2. Login con credenciales de evaluación
3. Consulta de zonas, dashboard y usuarios autenticados
4. POST de imagen OCR
5. Prueba de seguridad (sin token)
6. Medición de rendimiento (5 muestras)
7. Verificación de compatibilidad (Python, Node, npm)
8. Generación de imágenes PNG estilizadas por categoría

---

## Acceso de evaluación

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin@bluegrid.cl` | Documentada en `seed_admin.py` | `admin` |
| `supervisor@bluegrid.cl` | Documentada en script de seed | `supervisor` |
| `buzo@bluegrid.cl` | Documentada en script de seed | `buzo` |

Endpoints de validación:
```
http://127.0.0.1:8000/api/v1/health
http://127.0.0.1:8000/api/v1/ready
http://127.0.0.1:8000/docs
```

---

## Checklist de validación del ambiente de pruebas

- [x] Backend responde en `/health` con HTTP 200
- [x] `/ready` confirma `database: true`
- [x] `/ready` confirma `anthropic_key: true`
- [x] `/ready` confirma `jwt_secret: true`
- [x] Login admin funciona con HTTP 200 y JWT
- [x] Login inválido retorna HTTP 401
- [x] Ruta protegida sin token retorna HTTP 403
- [x] Dashboard retorna KPIs reales (no mock)
- [x] OCR procesó al menos una imagen con 25 celdas detectadas
- [x] Registros OCR guardados en BD (15 registros)
- [x] Latencia de `/health` < 1000 ms (promedio: 2 ms)
- [x] Frontend disponible en localhost:5173
- [x] OpenAPI con 22 endpoints disponible en /docs
