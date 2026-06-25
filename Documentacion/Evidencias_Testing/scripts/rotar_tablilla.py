from pathlib import Path
import sys

from PIL import Image, ImageOps


def main() -> int:
    if len(sys.argv) < 3:
        print("Uso: python rotar_tablilla.py <entrada> <salida> [clockwise|counterclockwise|180]")
        return 2

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    direction = sys.argv[3].lower() if len(sys.argv) >= 4 else "clockwise"

    if not input_path.exists():
        print(f"No existe la imagen de entrada: {input_path}")
        return 1

    image = Image.open(input_path)
    image = ImageOps.exif_transpose(image)

    if direction in {"clockwise", "cw", "90"}:
        rotated = image.rotate(-90, expand=True)
    elif direction in {"counterclockwise", "ccw", "-90"}:
        rotated = image.rotate(90, expand=True)
    elif direction in {"180", "flip"}:
        rotated = image.rotate(180, expand=True)
    else:
        print("Direccion no soportada. Usar: clockwise, counterclockwise o 180")
        return 2

    output_path.parent.mkdir(parents=True, exist_ok=True)
    rotated.save(output_path)

    print(f"Imagen original: {input_path}")
    print(f"Tamano original: {image.width}x{image.height}")
    print(f"Imagen rotada: {output_path}")
    print(f"Tamano rotado: {rotated.width}x{rotated.height}")
    print(f"Rotacion aplicada: {direction}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
