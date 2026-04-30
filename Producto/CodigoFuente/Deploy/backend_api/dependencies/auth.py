from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from services.jwt_service import decode_access_token

security = HTTPBearer()

ROLE_MAP = {
    "administrador general": "admin",
    "admin": "admin",
    "supervisor de zona": "supervisor",
    "supervisor": "supervisor",
    "operador de buceo": "buzo",
    "buzo": "buzo",
}

def normalize_role(role: str) -> str:
    normalized = ROLE_MAP.get(str(role).strip().lower())

    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Rol no reconocido"
        )

    return normalized

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )

    user_id = payload.get("sub")
    username = payload.get("username")
    name = payload.get("name")
    role = payload.get("role")

    if not user_id or not username or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token incompleto"
        )

    return {
        "id": user_id,
        "username": username,
        "name": name,
        "role": normalize_role(role),
    }

def require_roles(allowed_roles: list[str]):
    def checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para esta acción"
            )

        return current_user

    return checker
