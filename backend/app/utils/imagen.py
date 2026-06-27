import logging
from pathlib import Path

from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)

# Formatos permitidos
FORMATOS_PERMITIDOS = {"image/jpeg", "image/png", "image/webp"}
EXTENSIONES_PERMITIDAS = {".jpg", ".jpeg", ".png", ".webp"}

# Tamaño máximo en bytes
MAX_UPLOAD_SIZE = settings.max_upload_size_mb * 1024 * 1024


def validar_imagen(nombre_archivo: str, contenido: bytes) -> None:
    """
    Valida que el archivo sea una imagen con formato y tamaño permitidos.

    Args:
        nombre_archivo: Nombre del archivo (para detectar extensión).
        contenido: Contenido binario del archivo.

    Raises:
        ValueError: Si el formato o tamaño no son válidos.
    """
    # Validar tamaño
    if len(contenido) > MAX_UPLOAD_SIZE:
        raise ValueError(
            f"Imagen demasiado grande. Máximo {settings.max_upload_size_mb}MB. "
            f"Recibido: {len(contenido) / 1024 / 1024:.1f}MB"
        )

    # Validar extensión
    ext = Path(nombre_archivo).suffix.lower()
    if ext not in EXTENSIONES_PERMITIDAS:
        raise ValueError(
            f"Formato no soportado: '{ext}'. "
            f"Use: {', '.join(EXTENSIONES_PERMITIDAS)}"
        )

    # Validar que se pueda abrir como imagen
    try:
        img = Image.open(__import__("io").BytesIO(contenido))
        img.verify()
    except Exception as exc:
        raise ValueError(f"El archivo no es una imagen válida: {exc}") from exc


def mejorar_contraste(ruta_origen: str, ruta_destino: str | None = None) -> str:
    """
    Mejora el contraste de una imagen (útil para fotos oscuras de listados).

    Args:
        ruta_origen: Ruta a la imagen original.
        ruta_destino: Ruta para guardar la imagen mejorada. Si es None, sobreescribe.

    Returns:
        Ruta de la imagen procesada.
    """
    destino = ruta_destino or ruta_origen
    with Image.open(ruta_origen) as img:
        if img.mode != "L":
            img = img.convert("L")  # Convertir a escala de grises
        # Ecualización de histograma para mejorar contraste
        from PIL import ImageOps

        img_ecualizada = ImageOps.equalize(img)
        img_ecualizada.save(destino, quality=95)
    logger.info("Contraste mejorado: %s -> %s", ruta_origen, destino)
    return destino


def comprimir_foto_paciente(contenido: bytes, max_size: int = 300, quality: int = 60) -> bytes:
    """
    Comprime y redimensiona una foto de paciente para minimizar espacio.
    Reduce la imagen a max_size px en el lado más largo, la convierte a JPEG
    y aplica compresión quality.

    Args:
        contenido: Bytes de la imagen original.
        max_size: Tamaño máximo en píxeles del lado más largo.
        quality: Calidad JPEG (1-100).

    Returns:
        Bytes de la imagen comprimida en formato JPEG.
    """
    img = Image.open(__import__("io").BytesIO(contenido))
    if img.mode == "RGBA":
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    w, h = img.size
    if w > max_size or h > max_size:
        ratio = max_size / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    buf = __import__("io").BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    logger.info("Foto comprimida: %dx%d -> %dx%d, %dKB", w, h, img.width, img.height, buf.tell() // 1024)
    return buf.getvalue()
