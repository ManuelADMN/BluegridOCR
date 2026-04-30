import psycopg2
from core.config import settings

def get_connection():
    if not settings.DATABASE_URL:
        raise RuntimeError("DATABASE_URL no configurada")
    return psycopg2.connect(settings.DATABASE_URL, connect_timeout=10)
