import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient

from app.firestore import get_db
from app.schemas.respuesta import ErrorResponse
from app.config import settings

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
        paciente_ids = data.get("paciente_ids", [])
        total_verificados = 0
        if paciente_ids:
            patient_docs = await asyncio.gather(
                *[db.collection("pacientes").document(pid).get() for pid in paciente_ids]
            )
            total_verificados = sum(
                1 for pd in patient_docs
                if pd.exists and pd.to_dict().get("status_verificacion") == "verificado"
            )
        items.append({
            "id": data.get("id", doc.id),
            "imagen_gs_url": data.get("imagen_gs_url"),
            "total_pacientes": data.get("total_pacientes", 0),
            "total_verificados": total_verificados,
            "motor": data.get("motor"),
            "hospitales": data.get("hospitales", []),
            "paciente_ids": paciente_ids,
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
                "piso": pd.get("piso"),
                "habitacion": pd.get("habitacion"),
                "edad": pd.get("edad"),
                "estado_salud": pd.get("estado_salud"),
                "contacto": pd.get("contacto"),
                "status_verificacion": pd.get("status_verificacion", "no_verificado"),
                "confianza_global": pd.get("confianza_global"),
                "total_confirmaciones": pd.get("total_confirmaciones", 0),
                "total_reportes": pd.get("total_reportes", 0),
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


@router.get("/{upload_id}/imagen")
async def obtener_imagen_upload(
    upload_id: str,
    db: AsyncFirestoreClient = Depends(get_db),
):
    """Sirve la imagen original del upload directamente desde Cloud Storage."""
    doc = await db.collection("uploads").document(upload_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail={"detail": "Upload no encontrado", "error_code": "NOT_FOUND"})

    gs_url = doc.to_dict().get("imagen_gs_url")
    if not gs_url:
        raise HTTPException(status_code=404, detail={"detail": "Imagen no encontrada", "error_code": "NOT_FOUND"})

    try:
        from google.cloud import storage as gcs
        parts = gs_url.replace("gs://", "").split("/", 1)
        if len(parts) != 2:
            raise ValueError(f"URL inválida: {gs_url}")
        bucket = gcs.Client(project=settings.gcp_project).bucket(parts[0])
        blob = bucket.blob(parts[1])
        img_bytes = blob.download_as_bytes()
        return Response(content=img_bytes, media_type="image/jpeg")
    except Exception as exc:
        logger.warning("No se pudo leer imagen de Cloud Storage: %s", exc)
        raise HTTPException(status_code=404, detail={"detail": "No se pudo acceder a la imagen", "error_code": "FILE_NOT_FOUND"})


@router.delete("/{upload_id}")
async def eliminar_upload(
    upload_id: str,
    password: str = Header(alias="x-admin-password"),
    db: AsyncFirestoreClient = Depends(get_db),
):
    """Elimina un upload y todos sus pacientes asociados. Requiere contraseña admin."""
    if password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

    doc = await db.collection("uploads").document(upload_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail={"detail": "Upload no encontrado"})

    data = doc.to_dict()
    paciente_ids = data.get("paciente_ids", [])
    deleted_count = 0

    for pid in paciente_ids:
        sub_docs = db.collection("pacientes").document(pid).collection("extracciones").stream()
        async for sub in sub_docs:
            await sub.reference.delete()
        await db.collection("pacientes").document(pid).delete()
        deleted_count += 1

    await db.collection("uploads").document(upload_id).delete()
    logger.info("Upload %s eliminado con %s pacientes", upload_id, deleted_count)

    return {"message": f"Upload y {deleted_count} pacientes eliminados"}
