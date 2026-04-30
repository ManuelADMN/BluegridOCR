from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from core.config import settings

def create_access_token(data: dict) -> str:
    if not settings.JWT_SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY no configurada")

    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )

def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        return None
