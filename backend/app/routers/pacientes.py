import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient

from app.firestore import get_db
from app.schemas.paciente import PacienteCreate, PacienteDetail, PacienteList
from app.schemas.respuesta import ErrorResponse, SuccessResponse
from app.services import pacientes_service

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

    from app.services.extraccion_service import _generar_url_firmada
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
