import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile
from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient
from pydantic import BaseModel

from app.config import settings
from app.firestore import get_db
from app.services.vision_ocr_service import extraer_texto_vision
from app.utils.imagen import validar_imagen

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

CONFIG_DOC_PATH = ("_config", "settings")


class ConfigUpdate(BaseModel):
    extraction_engine: str
    contexto: str | None = None


async def _check_admin(password: str = Header(alias="x-admin-password")) -> None:
    if password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")


async def _get_config(db: AsyncFirestoreClient) -> dict:
    doc = await db.collection("_config").document("settings").get()
    if doc.exists:
        return doc.to_dict()
    return {}


async def _save_config(db: AsyncFirestoreClient, data: dict) -> None:
    data["updated_at"] = datetime.now(timezone.utc)
    await db.collection("_config").document("settings").set(data, merge=True)


@router.get("/config")
async def get_config(db: AsyncFirestoreClient = Depends(get_db)):
    """Obtiene la configuración actual del motor. Sin autenticación."""
    cfg = await _get_config(db)
    return {
        "extraction_engine": cfg.get("extraction_engine", settings.extraction_engine),
        "contexto": cfg.get("contexto", ""),
        "available_engines": ["gemini", "vision", "vision+gemini", "vision+gemini+image"],
        "default_engine": settings.extraction_engine,
    }


@router.post("/config")
async def set_config(
    data: ConfigUpdate,
    db: AsyncFirestoreClient = Depends(get_db),
    _=Depends(_check_admin),
):
    """Actualiza el motor de extracción desde el panel admin."""
    valid = {"gemini", "vision", "vision+gemini", "vision+gemini+image"}
    if data.extraction_engine not in valid:
        raise HTTPException(status_code=422, detail=f"Motor inválido. Use: {', '.join(valid)}")

    ext = data.extraction_engine
    ctx = data.contexto
    save_data: dict[str, object] = {"extraction_engine": ext}
    if ctx is not None:
        save_data["contexto"] = ctx
    await _save_config(db, save_data)
    logger.info("Motor cambiado a: %s (desde admin)", data.extraction_engine)

    return {
        "message": f"Motor cambiado a {data.extraction_engine}",
        "extraction_engine": data.extraction_engine,
    }


@router.post("/debug/ocr")
async def debug_ocr(
    file: UploadFile,
):
    """Extrae texto OCR de una imagen (solo debug)."""
    contenido = await file.read()
    validar_imagen(file.filename or "img.jpg", contenido)
    lineas = extraer_texto_vision(contenido)
    return {
        "total_lineas": len(lineas),
        "lineas": lineas,
        "primeras_10": lineas[:10],
    }
