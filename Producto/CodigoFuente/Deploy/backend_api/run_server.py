from pathlib import Path

import uvicorn

from core.config import settings


def main() -> None:
    kwargs = {
        "app": "main:app",
        "host": settings.HOST,
        "port": settings.PORT,
        "reload": settings.ENVIRONMENT == "development",
    }

    certfile = Path(settings.SSL_CERTFILE) if settings.SSL_CERTFILE else None
    keyfile = Path(settings.SSL_KEYFILE) if settings.SSL_KEYFILE else None

    if settings.HTTPS_ENABLED:
        if not certfile or not keyfile or not certfile.exists() or not keyfile.exists():
            raise RuntimeError(
                "HTTPS_ENABLED=true requiere SSL_CERTFILE y SSL_KEYFILE existentes."
            )
        kwargs["ssl_certfile"] = str(certfile)
        kwargs["ssl_keyfile"] = str(keyfile)

    uvicorn.run(**kwargs)


if __name__ == "__main__":
    main()
