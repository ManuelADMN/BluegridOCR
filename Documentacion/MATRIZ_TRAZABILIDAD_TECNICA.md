# Matriz de trazabilidad técnica

| Requisitos | Implementación principal | Prueba automatizada/evidencia | Estado técnico |
|---|---|---|---|
| RF-01–03 Login, JWT y roles | `routers/auth.py`, `dependencies/auth.py`, `services/jwt_service.py` | `test_rate_limit.py`, `test_route_security.py`, `types.spec.ts` | Cubierto |
| RF-04–07 Carga y validación de imagen | `routers/operations.py` | `test_validaciones.py`, evidencia OCR histórica | Cubierto; E2E visual pendiente de regresión final |
| RF-08–10 Motor IA y matriz | `services/motor_ia.py` | `test_motor_ia_full_rectangle.py` | Cubierto con pruebas de pipeline |
| RF-11–13 Edición, validación y rechazo | `MatrixEditor.tsx`, `routers/supervision.py` | validaciones de payload y pruebas de autorización | Cubierto parcialmente; CRUD real se valida manualmente sin mutar producción |
| RF-14–16 Persistencia y autoría | `operations.py`, `supervision.py`, migraciones SQL | pruebas de storage y evidencia API/BD | Cubierto |
| RF-17–19 Zonas, embarcaciones y tablillas | `routers/context.py`, `AdminUsersPanel.tsx` | rutas protegidas + validación Playwright | Cubierto |
| RF-20–23 Dashboard y analítica | `dashboard.py`, `analytics.py`, `Dashboard.tsx`, `BuzoAnalytics.tsx` | rutas protegidas + Playwright | Cubierto en lectura |
| RF-24–26 Usuarios y contraseñas | `routers/users.py`, `services/security.py` | `types.spec.ts`, pytest de autorización | Cubierto |
| RF-27 Auditoría | `services/audit.py`, `users.py` | eventos en login, OCR, validación, rechazo, usuarios, embarcaciones y tablillas | Implementado; verificación BD pendiente de la regresión local |
| RF-28–29 Health/readiness | `routers/health.py` | `test_route_security.py`, smoke tests | Cubierto |
| RF-30 Docker | Dockerfiles y Compose raíz/anidado | `docker compose config --quiet`, workflow CI | Configuración cubierta; daemon local no disponible |
| RNF Seguridad | RBAC, secretos externos, rate limit, headers Nginx | pytest, ESLint, npm audit, pip-audit | Cubierto sin hallazgos conocidos |
| RNF Portabilidad | Docker, runtime config, proxy same-origin | `runtimeConfig.spec.ts`, Compose CI | Cubierto |
| RNF Mantenibilidad | routers/servicios, lint, dependencias fijadas | ESLint + pytest + CI | Cubierto |
| RNF Observabilidad | logs, `/health`, `/ready` | smoke tests | Básico cubierto |

Última línea base local: **52 pruebas backend, 24 frontend, 51% de cobertura sobre código de aplicación, lint aprobado, npm audit sin vulnerabilidades y pip-audit sin vulnerabilidades conocidas**.
