import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    APP_TIMEZONE: str = os.getenv("APP_TIMEZONE", "America/Santiago")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    # Modelo del OCR fijado a Claude Sonnet 5.0. Se deja constante (no configurable por
    # entorno) para garantizar que el motor OCR y su auditoría de conteo usen siempre
    # el mismo modelo de visión validado.
    ANTHROPIC_MODEL: str = "claude-sonnet-5"
    ANTHROPIC_OCR_AUDIT_MODEL: str = "claude-sonnet-5"

    # Modo del motor OCR. "segmented" (default) = pipeline actual de recortes/contact sheets.
    # "full_rectangle" = enviar a Claude una sola imagen del rectángulo completo rectificado
    # y rotado para lectura humana. No cambia el comportamiento por defecto.
    OCR_MODE: str = os.getenv("OCR_MODE", "segmented")

    # Raíz de almacenamiento de imágenes en disco (reemplazo de Blob Storage).
    # En la EC2 se monta un bind mount: /opt/bluegridocr/data -> /data (env STORAGE_ROOT=/data).
    # En local, por defecto se usa backend_api/var/images (gitignored).
    STORAGE_ROOT: str = os.getenv("STORAGE_ROOT") or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "var", "images"
    )

    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    TRUST_PROXY_HEADERS: bool = os.getenv("TRUST_PROXY_HEADERS", "false").strip().lower() in {
        "1", "true", "yes", "on"
    }

    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    HTTPS_ENABLED: bool = os.getenv("HTTPS_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}
    SSL_CERTFILE: str = os.getenv("SSL_CERTFILE", "")
    SSL_KEYFILE: str = os.getenv("SSL_KEYFILE", "")

    RAW_ALLOWED_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,https://localhost:5173,http://localhost:3000,https://localhost:3000"
    )

    @property
    def allowed_origins(self) -> list[str]:
        origins = [
            origin.strip()
            for origin in self.RAW_ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]
        if self.ENVIRONMENT == "development":
            origins.extend([
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ])
        return list(dict.fromkeys(origins))

settings = Settings()
