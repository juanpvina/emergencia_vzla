import logging

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse, Response
from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient

from app.firestore import get_db
from app.schemas.extraccion import ExtraccionResult
from app.schemas.respuesta import ErrorResponse
from app.services import extraccion_service
from app.services.excel_service import generar_plantilla_excel
from app.services.gemini_service import GeminiAuthError, GeminiQuotaError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/extraccion", tags=["Extracción VLM"])


@router.post(
    "/upload",
    response_model=ExtraccionResult,
    responses={
        413: {"model": ErrorResponse},
        415: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        429: {"description": "Cuota de Gemini agotada"},
    },
)
async def upload_imagen(
    file: UploadFile,
    motor: str = Query(
        default=None,
        description="Motor: 'gemini', 'vision', 'vision+gemini'. Default: configuración del panel admin.",
        pattern=r"^(gemini|vision|vision\+gemini)$",
    ),
    db: AsyncFirestoreClient = Depends(get_db),
):
    """
    Sube una imagen de listado hospitalario para extraer datos de pacientes.

    **Motores disponibles:**
    - **gemini**: Gemini Vision analiza la imagen directamente (requiere GEMINI_API_KEY)
    - **vision**: Cloud Vision OCR extrae texto + parser rule-based (gratis 1000/img/mes, sin IA)
    - **vision+gemini**: Cloud Vision OCR + Gemini estructura el texto (más preciso que vision solo)
    """
    if not file.filename:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Nombre de archivo requerido", "error_code": "INVALID_FILE"},
        )

    contenido = await file.read()

    if len(contenido) == 0:
        raise HTTPException(
            status_code=422,
            detail={"detail": "El archivo está vacío", "error_code": "EMPTY_FILE"},
        )

    try:
        resultado = await extraccion_service.procesar_imagen(
            nombre_archivo=file.filename,
            contenido=contenido,
            db=db,
            motor=motor,
        )
        return resultado
    except GeminiQuotaError as exc:
        logger.warning("Cuota de Gemini agotada. Retry after: %s", exc.retry_after_seconds)
        headers = {}
        if exc.retry_after_seconds:
            headers["Retry-After"] = str(exc.retry_after_seconds)
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Cuota de Gemini API agotada.",
                "error_code": "GEMINI_QUOTA_EXCEEDED",
                "retry_after_seconds": exc.retry_after_seconds,
            },
            headers=headers,
        )
    except GeminiAuthError as exc:
        return JSONResponse(
            status_code=401,
            content={"detail": str(exc), "error_code": "GEMINI_AUTH_ERROR"},
        )
    except ValueError as exc:
        mensaje = str(exc)
        if "demasiado grande" in mensaje.lower():
            raise HTTPException(status_code=413, detail={"detail": mensaje, "error_code": "FILE_TOO_LARGE"})
        if "formato no soportado" in mensaje.lower():
            raise HTTPException(status_code=415, detail={"detail": mensaje, "error_code": "UNSUPPORTED_FORMAT"})
        raise HTTPException(status_code=422, detail={"detail": mensaje, "error_code": "VALIDATION_ERROR"})
    except Exception as exc:
        logger.exception("Error inesperado procesando imagen")
        raise HTTPException(status_code=500, detail={"detail": f"Error interno: {str(exc)}", "error_code": "INTERNAL_ERROR"})


@router.post("/upload-excel", response_model=ExtraccionResult)
async def upload_excel(
    file: UploadFile,
    db: AsyncFirestoreClient = Depends(get_db),
):
    """
    Sube un archivo Excel (.xlsx) con datos de pacientes.

    El archivo debe seguir el formato de la plantilla descargable en
    GET /api/v1/extraccion/plantilla-excel
    """
    if not file.filename:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Nombre de archivo requerido", "error_code": "INVALID_FILE"},
        )

    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=415,
            detail={"detail": "Formato no soportado. Use archivos .xlsx", "error_code": "UNSUPPORTED_FORMAT"},
        )

    contenido = await file.read()

    if len(contenido) == 0:
        raise HTTPException(
            status_code=422,
            detail={"detail": "El archivo está vacío", "error_code": "EMPTY_FILE"},
        )

    try:
        resultado = await extraccion_service.procesar_excel(contenido=contenido, db=db)
        return resultado
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"detail": str(exc), "error_code": "VALIDATION_ERROR"})
    except Exception as exc:
        logger.exception("Error procesando Excel")
        raise HTTPException(status_code=500, detail={"detail": f"Error interno: {str(exc)}", "error_code": "INTERNAL_ERROR"})


@router.get("/plantilla-excel")
async def descargar_plantilla():
    """
    Descarga la plantilla Excel vacía para cargar pacientes.

    Incluye hoja de instrucciones y formato predefinido.
    """
    contenido = generar_plantilla_excel()
    return Response(
        content=contenido,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=plantilla_pacientes.xlsx"
        },
    )
