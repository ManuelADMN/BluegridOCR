from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.logger import logger

from routers import auth
from routers import users
from routers import dashboard
from routers import operations
from routers import supervision
from routers import context
from routers import health
from routers import analytics
from routers import reports
from routers import training

app = FastAPI(
    title="BluegridOCR API",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(context.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(operations.router, prefix="/api/v1")
app.include_router(supervision.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(training.router, prefix="/api/v1")

@app.on_event("startup")
async def on_startup():
    logger.info("=" * 60)
    logger.info("[STARTUP] BluegridOCR API v1.0.0 iniciada")
    logger.info("[STARTUP] environment=%s", settings.ENVIRONMENT)
    logger.info("[STARTUP] model=%s  audit_model=%s", settings.ANTHROPIC_MODEL, settings.ANTHROPIC_OCR_AUDIT_MODEL)
    logger.info("[STARTUP] Logs guardados en: backend_api/logs/app.log")
    logger.info("=" * 60)


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "BluegridOCR API",
        "version": "1.0.0"
    }
