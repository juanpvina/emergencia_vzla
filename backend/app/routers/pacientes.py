import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import RedirectResponse, Response
from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient

from app.firestore import get_db
from app.schemas.paciente import PacienteCreate, PacienteDetail, PacienteList, PacienteUpdate
from app.schemas.respuesta import ErrorResponse, SuccessResponse
from app.services import pacientes_service
from app.services.extraccion_service import _subir_a_cloud_storage, _generar_url_firmada
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/pacientes", tags=["Pacientes"])


@router.get("", response_model=PacienteList)
async def listar_pacientes(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncFirestoreClient = Depends(get_db),
):
    return await pacientes_service.listar_pacientes(db, limit=limit, offset=offset)


@router.post("", response_model=SuccessResponse)
async def crear_paciente(
    data: PacienteCreate,
    db: AsyncFirestoreClient = Depends(get_db),
):
    """Registra manualmente un paciente/desaparecido."""
    paciente = await pacientes_service.crear_paciente_manual(db, data)
    return SuccessResponse(
        message="Paciente registrado exitosamente",
        data={"id": paciente.id, "nombre": paciente.nombre, "cedula": paciente.cedula},
    )


@router.get(
    "/{paciente_id}",
    response_model=PacienteDetail,
    responses={404: {"model": ErrorResponse}},
)
async def obtener_paciente(
    paciente_id: str,
    db: AsyncFirestoreClient = Depends(get_db),
):
    paciente = await pacientes_service.obtener_paciente(db, paciente_id)
    if not paciente:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Paciente no encontrado", "error_code": "NOT_FOUND"},
        )
    return paciente


@router.get(
    "/{paciente_id}/imagen",
    responses={404: {"model": ErrorResponse}},
)
async def obtener_imagen_paciente(
    paciente_id: str,
    db: AsyncFirestoreClient = Depends(get_db),
):
    """Redirige a la URL firmada de Cloud Storage."""
    gs_url = await pacientes_service.ruta_imagen_paciente(db, paciente_id)
    if not gs_url:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Imagen no encontrada para este paciente", "error_code": "NOT_FOUND"},
        )

    signed_url = _generar_url_firmada(gs_url)
    if signed_url:
        return RedirectResponse(url=signed_url)

    raise HTTPException(
        status_code=404,
        detail={"detail": "No se pudo generar URL de acceso a la imagen", "error_code": "FILE_NOT_FOUND"},
    )


@router.get(
    "/{paciente_id}/extracciones",
    responses={404: {"model": ErrorResponse}},
)
async def obtener_extracciones(
    paciente_id: str,
    db: AsyncFirestoreClient = Depends(get_db),
):
    paciente = await pacientes_service.obtener_paciente(db, paciente_id)
    if not paciente:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Paciente no encontrado", "error_code": "NOT_FOUND"},
        )
    extracciones = await pacientes_service.obtener_extracciones(db, paciente_id)
    return {"paciente_id": paciente_id, "extracciones": extracciones}


@router.post(
    "/{paciente_id}/foto",
    responses={404: {"model": ErrorResponse}},
)
async def subir_foto_paciente(
    paciente_id: str,
    file: UploadFile,
    db: AsyncFirestoreClient = Depends(get_db),
):
    """Sube una foto del paciente (no del listado)."""
    paciente = await pacientes_service.obtener_paciente(db, paciente_id)
    if not paciente:
        raise HTTPException(status_code=404, detail={"detail": "Paciente no encontrado", "error_code": "NOT_FOUND"})

    contenido = await file.read()
    if len(contenido) == 0:
        raise HTTPException(status_code=422, detail={"detail": "Archivo vacío", "error_code": "EMPTY_FILE"})

    from app.utils.imagen import validar_imagen, comprimir_foto_paciente
    validar_imagen(file.filename or "foto.jpg", contenido)

    contenido_comprimido = comprimir_foto_paciente(contenido)

    try:
        gs_url = _subir_a_cloud_storage(contenido_comprimido, f"paciente_{paciente_id}.jpg", content_type="image/jpeg", prefix="pacientes")
    except Exception as exc:
        logger.warning("No se pudo subir foto a Cloud Storage: %s", exc)
        gs_url = None

    await db.collection("pacientes").document(paciente_id).update({
        "foto_paciente_url": gs_url,
        "updated_at": datetime.now(timezone.utc),
    })

    return SuccessResponse(message="Foto subida exitosamente", data={"foto_url": gs_url})

    return SuccessResponse(message="Foto subida exitosamente", data={"foto_url": gs_url})


@router.get(
    "/{paciente_id}/foto-paciente",
    responses={404: {"model": ErrorResponse}},
)
async def obtener_foto_paciente(
    paciente_id: str,
    db: AsyncFirestoreClient = Depends(get_db),
):
    """Devuelve la foto del paciente directamente desde Cloud Storage."""
    doc = await db.collection("pacientes").document(paciente_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail={"detail": "Paciente no encontrado", "error_code": "NOT_FOUND"})
    gs_url = doc.to_dict().get("foto_paciente_url")
    if not gs_url:
        raise HTTPException(status_code=404, detail={"detail": "Foto no encontrada", "error_code": "NOT_FOUND"})

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
        raise HTTPException(status_code=404, detail={"detail": "No se pudo acceder a la foto", "error_code": "FILE_NOT_FOUND"})


@router.put(
    "/{paciente_id}",
    responses={404: {"model": ErrorResponse}},
)
async def actualizar_paciente(
    paciente_id: str,
    data: PacienteUpdate,
    db: AsyncFirestoreClient = Depends(get_db),
):
    """Actualiza los datos de un paciente."""
    doc = await db.collection("pacientes").document(paciente_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail={"detail": "Paciente no encontrado", "error_code": "NOT_FOUND"})

    update = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(status_code=422, detail={"detail": "No hay datos para actualizar", "error_code": "NO_DATA"})

    if "cedula" in update and update["cedula"]:
        update["cedula"] = "".join(c for c in update["cedula"] if c.isdigit())
    if "nombre" in update:
        update["nombre_lower"] = update["nombre"].lower().strip()
        update["nombre_tokens"] = [t for t in update["nombre_lower"].split() if t]

    update["updated_at"] = datetime.now(timezone.utc)
    await db.collection("pacientes").document(paciente_id).update(update)
    return SuccessResponse(message="Paciente actualizado", data={"id": paciente_id})


@router.delete(
    "/{paciente_id}",
    responses={404: {"model": ErrorResponse}},
)
async def eliminar_paciente(
    paciente_id: str,
    db: AsyncFirestoreClient = Depends(get_db),
):
    """Elimina un paciente y sus subcolecciones."""
    doc = await db.collection("pacientes").document(paciente_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail={"detail": "Paciente no encontrado", "error_code": "NOT_FOUND"})

    extracciones = db.collection("pacientes").document(paciente_id).collection("extracciones")
    async for edoc in extracciones.stream():
        await edoc.reference.delete()

    verificaciones = db.collection("pacientes").document(paciente_id).collection("verificaciones")
    async for vdoc in verificaciones.stream():
        await vdoc.reference.delete()

    await db.collection("pacientes").document(paciente_id).delete()
    return SuccessResponse(message="Paciente eliminado", data={"id": paciente_id})
