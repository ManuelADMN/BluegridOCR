"""
Almacenamiento de imágenes en el filesystem de la instancia (reemplazo de Blob Storage).

Esquema de identificación dentro de la instancia (STORAGE_ROOT):
    <STORAGE_ROOT>/registros/{id_registro}/original.jpg      # imagen subida por el buzo
                                          /warped.png         # imagen rectificada (debug)
                                          /grid_preview.png   # grilla detectada (debug)

La ruta RELATIVA (p.ej. "registros/12/original.jpg") es la que se guarda en
registros_ocr.url_imagen_original / url_imagen_procesada. El servido se hace por la API
protegida GET /api/v1/registros/{id}/imagen (solo admin/supervisor).

Sin dependencias de red ni de base de datos: es puramente filesystem, testeable offline.
"""
import base64
import shutil
from pathlib import Path

from core.config import settings
from core.logger import logger

# tipo lógico -> nombre de archivo en disco
ALLOWED_TIPOS: dict[str, str] = {
    "original": "original.jpg",
    "warped": "warped.png",
    "preview": "grid_preview.png",
}

# media types para servir cada tipo
MEDIA_TYPES: dict[str, str] = {
    "original": "image/jpeg",
    "warped": "image/png",
    "preview": "image/png",
}


def _root() -> Path:
    return Path(settings.STORAGE_ROOT)


def _id_valido(id_registro) -> int:
    """Convierte y valida el id (entero positivo). Evita path traversal: nunca se usa texto."""
    rid = int(id_registro)
    if rid <= 0:
        raise ValueError(f"id_registro inválido: {id_registro!r}")
    return rid


def _validar_tipo(tipo: str) -> str:
    if tipo not in ALLOWED_TIPOS:
        raise ValueError(f"tipo de imagen no permitido: {tipo!r}")
    return tipo


def registro_dir(id_registro) -> Path:
    return _root() / "registros" / str(_id_valido(id_registro))


def ruta_imagen(id_registro, tipo: str = "original") -> Path:
    return registro_dir(id_registro) / ALLOWED_TIPOS[_validar_tipo(tipo)]


def ruta_relativa(id_registro, tipo: str = "original") -> str:
    """Ruta relativa a STORAGE_ROOT, para persistir en la BD (ej: registros/12/original.jpg)."""
    return ruta_imagen(id_registro, tipo).relative_to(_root()).as_posix()


def guardar_bytes(id_registro, tipo: str, data: bytes) -> str:
    """Guarda bytes en disco y devuelve la ruta relativa a STORAGE_ROOT."""
    destino = ruta_imagen(id_registro, tipo)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(data)
    rel = destino.relative_to(_root()).as_posix()
    logger.info("[STORAGE] guardado tipo=%s bytes=%d -> %s", tipo, len(data), rel)
    return rel


def guardar_b64(id_registro, tipo: str, b64: str | None) -> str | None:
    """Decodifica base64 y guarda. Devuelve None si no hay datos (sin fallar)."""
    if not b64:
        return None
    return guardar_bytes(id_registro, tipo, base64.b64decode(b64))


def existe(id_registro, tipo: str = "original") -> bool:
    try:
        return ruta_imagen(id_registro, tipo).is_file()
    except Exception:
        return False


def eliminar_directorio(id_registro) -> int:
    """Elimina de forma irreversible todos los archivos de un registro (imágenes original,
    rectificada y previews) borrando su carpeta `registros/{id}/`.

    Devuelve la cantidad de archivos eliminados. Es idempotente: si la carpeta no existe,
    devuelve 0. Soporta el derecho de supresión de la Ley 21.719 (arts. 4 y 7).

    El id se valida como entero positivo (nunca texto), por lo que no es posible construir
    una ruta fuera de STORAGE_ROOT (defensa contra path traversal).
    """
    destino = registro_dir(id_registro)  # valida el id
    root = _root().resolve()
    resuelto = destino.resolve()
    # Salvaguarda extra: nunca borrar fuera de la raíz de almacenamiento.
    if root not in resuelto.parents:
        raise ValueError(f"ruta fuera de STORAGE_ROOT: {resuelto}")

    if not destino.is_dir():
        return 0

    archivos = sum(1 for p in destino.rglob("*") if p.is_file())
    shutil.rmtree(destino)
    logger.info("[STORAGE] purga registro=%s archivos_eliminados=%d", id_registro, archivos)
    return archivos
