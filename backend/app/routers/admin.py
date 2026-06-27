import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient
from pydantic import BaseModel

from app.config import settings
from app.firestore import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

CONFIG_DOC_PATH = ("_config", "settings")


class ConfigUpdate(BaseModel):
    extraction_engine: str


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
        "available_engines": ["gemini", "vision", "vision+gemini"],
        "default_engine": settings.extraction_engine,
    }


@router.post("/config")
async def set_config(
    data: ConfigUpdate,
    db: AsyncFirestoreClient = Depends(get_db),
    _=Depends(_check_admin),
):
    """Actualiza el motor de extracción desde el panel admin."""
    valid = {"gemini", "vision", "vision+gemini"}
    if data.extraction_engine not in valid:
        raise HTTPException(status_code=422, detail=f"Motor inválido. Use: {', '.join(valid)}")

    await _save_config(db, {"extraction_engine": data.extraction_engine})
    logger.info("Motor cambiado a: %s (desde admin)", data.extraction_engine)

    return {
        "message": f"Motor cambiado a {data.extraction_engine}",
        "extraction_engine": data.extraction_engine,
    }
