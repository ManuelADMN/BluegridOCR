import psycopg2
from core.config import settings
from core.logger import logger

def get_connection():
    if not settings.DATABASE_URL:
        raise RuntimeError("DATABASE_URL no configurada")
    logger.debug("[DB] Abriendo conexión a Supabase...")
    conn = psycopg2.connect(settings.DATABASE_URL, connect_timeout=10)
    with conn.cursor() as cur:
        cur.execute("SET TIME ZONE %s", (settings.APP_TIMEZONE,))
    logger.debug("[DB] Conexión establecida OK")
    return conn
