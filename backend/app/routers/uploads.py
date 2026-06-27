import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient

from app.firestore import get_db
from app.schemas.respuesta import ErrorResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/uploads", tags=["Uploads"])


@router.get("")
async def listar_uploads(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncFirestoreClient = Depends(get_db),
):
    """Lista todos los uploads de imágenes (ordenados del más reciente al más antiguo)."""
    uploads_ref = db.collection("uploads").order_by("created_at", direction="DESCENDING").limit(limit)
    docs = [d async for d in uploads_ref.stream()]
    docs = docs[offset:offset + limit] if offset else docs[:limit]

    items = []
    for doc in docs:
        data = doc.to_dict()
        items.append({
            "id": data.get("id", doc.id),
            "total_pacientes": data.get("total_pacientes", 0),
            "motor": data.get("motor"),
            "hospitales": data.get("hospitales", []),
            "paciente_ids": data.get("paciente_ids", []),
            "created_at": data.get("created_at"),
        })

    return {"items": items, "total": len(items), "limit": limit, "offset": offset}


@router.get("/{upload_id}")
async def obtener_upload(
    upload_id: str,
    db: AsyncFirestoreClient = Depends(get_db),
):
    """Obtiene un upload con los datos de los pacientes asociados."""
    doc = await db.collection("uploads").document(upload_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail={"detail": "Upload no encontrado", "error_code": "NOT_FOUND"})

    data = doc.to_dict()
    pacientes = []
    for pid in data.get("paciente_ids", []):
        pdoc = await db.collection("pacientes").document(pid).get()
        if pdoc.exists:
            pd = pdoc.to_dict()
            pacientes.append({
                "id": pid,
                "nombre": pd.get("nombre"),
                "cedula": pd.get("cedula"),
                "hospital": pd.get("hospital"),
                "status_verificacion": pd.get("status_verificacion", "no_verificado"),
            })

    return {
        "id": upload_id,
        "imagen_gs_url": data.get("imagen_gs_url"),
        "motor": data.get("motor"),
        "hospitales": data.get("hospitales", []),
        "total_pacientes": data.get("total_pacientes", 0),
        "pacientes": pacientes,
        "created_at": data.get("created_at"),
    }
