from fastapi import APIRouter
from services.db import get_connection
from core.config import settings

router = APIRouter(tags=["Health"])

@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "BluegridOCR API",
        "environment": settings.ENVIRONMENT
    }

@router.get("/ready")
def ready():
    checks = {
        "database": False,
        "anthropic_key": bool(settings.ANTHROPIC_API_KEY),
        "jwt_secret": bool(settings.JWT_SECRET_KEY),
    }

    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
        conn.close()
        checks["database"] = True
    except Exception:
        checks["database"] = False

    return {
        "status": "ready" if all(checks.values()) else "not_ready",
        "checks": checks,
        "anthropic_model": settings.ANTHROPIC_MODEL
    }
