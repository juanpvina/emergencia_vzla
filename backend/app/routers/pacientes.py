import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import RedirectResponse
from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient

from app.firestore import get_db
from app.schemas.paciente import PacienteCreate, PacienteDetail, PacienteList
from app.schemas.respuesta import ErrorResponse, SuccessResponse
from app.services import pacientes_service
from app.services.extraccion_service import _subir_a_cloud_storage, _generar_url_firmada

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

    from app.utils.imagen import validar_imagen
    validar_imagen(file.filename or "foto.jpg", contenido)

    try:
        gs_url = _subir_a_cloud_storage(contenido, file.filename or "foto.jpg", content_type=file.content_type or "image/jpeg")
    except Exception:
        gs_url = None

    await db.collection("pacientes").document(paciente_id).update({
        "foto_paciente_url": gs_url,
        "updated_at": datetime.now(timezone.utc),
    })

    return SuccessResponse(message="Foto subida exitosamente", data={"foto_url": gs_url})


@router.get(
    "/{paciente_id}/foto-paciente",
    responses={404: {"model": ErrorResponse}},
)
async def obtener_foto_paciente(
    paciente_id: str,
    db: AsyncFirestoreClient = Depends(get_db),
):
    """Redirige a la URL firmada de la foto personal del paciente."""
    doc = await db.collection("pacientes").document(paciente_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail={"detail": "Paciente no encontrado", "error_code": "NOT_FOUND"})
    gs_url = doc.to_dict().get("foto_paciente_url")
    if not gs_url:
        raise HTTPException(status_code=404, detail={"detail": "Foto no encontrada", "error_code": "NOT_FOUND"})

    signed_url = _generar_url_firmada(gs_url)
    if signed_url:
        return RedirectResponse(url=signed_url)

    raise HTTPException(status_code=404, detail={"detail": "No se pudo generar URL de acceso", "error_code": "FILE_NOT_FOUND"})
