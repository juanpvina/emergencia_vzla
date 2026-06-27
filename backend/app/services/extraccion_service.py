import io
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from google.cloud import storage
from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient

from app.config import settings
from app.schemas.extraccion import (
    ExtraccionResult,
    GeminiResponse,
    PacienteExtraido,
)
from app.services.gemini_service import extraer_datos_desde_imagen
from app.services.vision_ocr_service import extraer_texto_vision, parsear_texto_a_pacientes, estructurar_texto_con_gemini, estructurar_con_gemini_con_imagen
from app.utils.imagen import mejorar_contraste, validar_imagen

logger = logging.getLogger(__name__)


def _v(campo):
    """Retorna .valor de un CampoExtraido o None si el campo es None."""
    return campo.valor if campo else None


def _get_storage_client():
    return storage.Client(project=settings.gcp_project)


def _subir_a_cloud_storage(contenido: bytes, nombre_archivo: str, content_type: str = "image/jpeg", prefix: str = "uploads") -> str:
    """Sube contenido a Cloud Storage y devuelve gs:// URL."""
    client = _get_storage_client()
    bucket = client.bucket(settings.storage_bucket)

    ext = Path(nombre_archivo).suffix or ".jpeg"
    blob_name = f"{prefix}/{uuid.uuid4().hex}{ext}"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(contenido, content_type=content_type)

    gs_url = f"gs://{settings.storage_bucket}/{blob_name}"
    logger.info("Imagen subida a Cloud Storage: %s", gs_url)
    return gs_url


def _generar_url_firmada(gs_url: str, expiration_hours: int = 24) -> str | None:
    """Genera URL firmada para acceder a la imagen desde el frontend."""
    try:
        client = _get_storage_client()
        parts = gs_url.replace("gs://", "").split("/", 1)
        if len(parts) != 2:
            return None
        bucket_name, blob_name = parts
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        return blob.generate_signed_url(
            expiration=datetime.now(timezone.utc) + timedelta(hours=expiration_hours)
        )
    except Exception as exc:
        logger.warning("No se pudo generar URL firmada: %s", exc)
        return None


async def procesar_imagen(
    nombre_archivo: str, contenido: bytes, db: AsyncFirestoreClient,
    motor: str | None = None,
) -> ExtraccionResult:
    """
    Procesa imagen de listado hospitalario con el motor especificado.
    Si motor es None, lee la configuración desde Firestore.
    """
    motor = motor or await _get_engine_from_firestore(db)
    contexto = await _get_contexto_from_firestore(db)

    validar_imagen(nombre_archivo, contenido)

    try:
        gs_url = _subir_a_cloud_storage(contenido, nombre_archivo)
    except Exception as exc:
        logger.warning("No se pudo subir a Cloud Storage (modo local sin credenciales?): %s", exc)
        gs_url = None

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    temp_path = upload_dir / f"temp_{uuid.uuid4().hex}.jpeg"
    with open(temp_path, "wb") as f:
        f.write(contenido)

    try:
        if motor == "gemini":
            respuesta_gemini: GeminiResponse = await _procesar_con_gemini(temp_path, contexto)
            modelo_vlm = settings.gemini_model
        elif motor == "vision":
            respuesta_gemini = _procesar_con_vision(contenido)
            modelo_vlm = "cloud-vision+parser"
        elif motor == "vision+gemini":
            respuesta_gemini = await _procesar_con_vision_y_gemini(contenido, contexto)
            modelo_vlm = "cloud-vision+gemini"
        elif motor == "vision+gemini+image":
            respuesta_gemini = await _procesar_con_vision_gemini_imagen(temp_path, contenido, contexto)
            modelo_vlm = "cloud-vision+gemini+image"
        else:
            raise ValueError(
                f"Motor '{motor}' no válido. Use: gemini, vision, vision+gemini, vision+gemini+image"
            )
    finally:
        for p in [temp_path, Path(str(temp_path).replace(".jpeg", "_mejorada.jpeg"))]:
            if p.exists():
                p.unlink()

    pacientes_ids = []
    hospitales = set()
    for paciente_data in respuesta_gemini.pacientes:
        paciente_id = await _guardar_paciente_y_extraccion_firestore(
            db=db,
            paciente_data=paciente_data,
            gs_url=gs_url,
            respuesta_gemini=respuesta_gemini,
            origen=f"imagen_{motor}",
        )
        pacientes_ids.append(paciente_id)
        if _v(paciente_data.hospital):
            hospitales.add(_v(paciente_data.hospital))

    await _registrar_upload(db, gs_url, pacientes_ids, motor, list(hospitales))

    return ExtraccionResult(
        pacientes_creados=pacientes_ids,
        total_pacientes=len(respuesta_gemini.pacientes),
        advertencias=respuesta_gemini.advertencias,
        raw_respuesta=respuesta_gemini,
    )


async def _procesar_con_gemini(temp_path, contexto: str = "") -> GeminiResponse:
    """Motor gemini: Gemini Vision directo sobre la imagen."""
    ruta_mejorada = mejorar_contraste(str(temp_path))
    return await extraer_datos_desde_imagen(ruta_mejorada, contexto)


def _procesar_con_vision(contenido: bytes) -> GeminiResponse:
    """Motor vision: Cloud Vision OCR + parser rule-based (sin LLM)."""
    lineas = extraer_texto_vision(contenido)
    return parsear_texto_a_pacientes(lineas)


async def _procesar_con_vision_y_gemini(contenido: bytes, contexto: str = "") -> GeminiResponse:
    """Motor vision+gemini: Cloud Vision OCR + Gemini estructura el texto."""
    lineas = extraer_texto_vision(contenido)
    if not lineas:
        return GeminiResponse(pacientes=[], advertencias=["No se detectó texto en la imagen"])
    return await estructurar_texto_con_gemini(lineas, contexto)


async def _procesar_con_vision_gemini_imagen(temp_path: Path, contenido: bytes, contexto: str = "") -> GeminiResponse:
    """Motor vision+gemini+image: Cloud Vision OCR + Gemini estructura con texto E imagen."""
    lineas = extraer_texto_vision(contenido)
    if not lineas:
        return GeminiResponse(pacientes=[], advertencias=["No se detectó texto en la imagen"])
    return await estructurar_con_gemini_con_imagen(str(temp_path), lineas, contexto)


async def procesar_excel(
    contenido: bytes, db: AsyncFirestoreClient
) -> ExtraccionResult:
    """Procesa archivo Excel con datos de pacientes (sin Gemini)."""
    from app.services.excel_service import parsear_excel
    pacientes_data, advertencias = parsear_excel(contenido)

    pacientes_ids = []
    for data in pacientes_data:
        paciente_id = await _guardar_paciente_desde_excel(db, data)
        pacientes_ids.append(paciente_id)

    return ExtraccionResult(
        pacientes_creados=pacientes_ids,
        total_pacientes=len(pacientes_data),
        advertencias=advertencias,
        raw_respuesta=None,
    )


async def _guardar_paciente_y_extraccion_firestore(
    db: AsyncFirestoreClient,
    paciente_data: PacienteExtraido,
    gs_url: str,
    respuesta_gemini,
    origen: str = "imagen",
) -> str:
    cedula = _v(paciente_data.cedula)
    edad = _parsear_edad(_v(paciente_data.edad))
    now = datetime.now(timezone.utc)

    paciente_id = None
    paciente_ref = None
    if cedula:
        docs = db.collection("pacientes").where(
            field_path="cedula", op_string="==", value=cedula
        ).limit(1)
        results = [d async for d in docs.stream()]
        if results:
            paciente_ref = results[0]
            paciente_id = paciente_ref.id
            logger.info("Paciente existente (cédula %s), vinculando extracción", cedula)

    if not paciente_id:
        paciente_id = uuid.uuid4().hex
        nombre = _v(paciente_data.nombre) or "S/N"
        nombre_lower = nombre.lower().strip()
        nombre_tokens = [t for t in nombre_lower.split() if t]

        paciente_data_fs = {
            "id": paciente_id,
            "nombre": nombre,
            "cedula": cedula,
            "nombre_lower": nombre_lower,
            "nombre_tokens": nombre_tokens,
            "hospital": _v(paciente_data.hospital),
            "piso": _v(paciente_data.piso),
            "habitacion": _v(paciente_data.habitacion),
            "edad": edad,
            "estado_salud": _v(paciente_data.estado_salud),
            "contacto": _v(paciente_data.contacto),
            "foto_url": gs_url,
            "status_verificacion": "no_verificado",
            "confianza_global": None,
            "ultima_extraccion_id": None,
            "total_confirmaciones": 0,
            "total_reportes": 0,
            "created_at": now,
            "updated_at": now,
            "origen": origen,
        }
        await db.collection("pacientes").document(paciente_id).set(paciente_data_fs)
        logger.info("Nuevo paciente creado: %s", nombre)

    confs = [
        paciente_data.nombre.confianza if paciente_data.nombre else None,
        paciente_data.cedula.confianza if paciente_data.cedula else None,
        paciente_data.hospital.confianza if paciente_data.hospital else None,
        paciente_data.piso.confianza if paciente_data.piso else None,
        paciente_data.habitacion.confianza if paciente_data.habitacion else None,
        paciente_data.estado_salud.confianza if paciente_data.estado_salud else None,
        paciente_data.contacto.confianza if paciente_data.contacto else None,
    ]
    confs_validas = [c for c in confs if c is not None]
    conf_global = sum(confs_validas) / len(confs_validas) if confs_validas else None

    extraccion_id = uuid.uuid4().hex
    extraccion_data = {
        "id": extraccion_id,
        "paciente_id": paciente_id,
        "imagen_gs_url": gs_url,
        "modelo_vlm": settings.gemini_model,
        "prompt_usado": None,
        "raw_output": respuesta_gemini.model_dump(mode="json"),
        "metadatos": None,
        "conf_nombre": paciente_data.nombre.confianza if paciente_data.nombre else None,
        "conf_cedula": paciente_data.cedula.confianza if paciente_data.cedula else None,
        "conf_hospital": paciente_data.hospital.confianza if paciente_data.hospital else None,
        "conf_piso": paciente_data.piso.confianza if paciente_data.piso else None,
        "conf_habitacion": paciente_data.habitacion.confianza if paciente_data.habitacion else None,
        "conf_estado": paciente_data.estado_salud.confianza if paciente_data.estado_salud else None,
        "conf_contacto": paciente_data.contacto.confianza if paciente_data.contacto else None,
        "conf_global": conf_global,
        "es_completo": True,
        "razon_parcial": None,
        "created_at": now,
    }
    await db.collection("pacientes").document(paciente_id).collection("extracciones").document(extraccion_id).set(extraccion_data)

    await db.collection("pacientes").document(paciente_id).update({
        "confianza_global": conf_global,
        "ultima_extraccion_id": extraccion_id,
        "updated_at": now,
        "foto_url": gs_url,
    })

    return paciente_id


async def _guardar_paciente_desde_excel(db: AsyncFirestoreClient, data: dict) -> str:
    cedula = _normalizar_cedula(data.get("cedula", "")) if data.get("cedula") else None
    now = datetime.now(timezone.utc)

    paciente_id = None
    if cedula:
        docs = db.collection("pacientes").where(
            field_path="cedula", op_string="==", value=cedula
        ).limit(1)
        results = [d async for d in docs.stream()]
        if results:
            paciente_id = results[0].id

    if not paciente_id:
        paciente_id = uuid.uuid4().hex
        nombre = data.get("nombre", "S/N")
        nombre_lower = nombre.lower().strip()
        nombre_tokens = [t for t in nombre_lower.split() if t]

        paciente_data_fs = {
            "id": paciente_id,
            "nombre": nombre,
            "cedula": cedula,
            "nombre_lower": nombre_lower,
            "nombre_tokens": nombre_tokens,
            "hospital": data.get("hospital"),
            "piso": str(data.get("piso")) if data.get("piso") else None,
            "habitacion": str(data.get("habitacion")) if data.get("habitacion") else None,
            "edad": int(data["edad"]) if data.get("edad") else None,
            "estado_salud": data.get("estado_salud"),
            "contacto": data.get("contacto"),
            "foto_url": None,
            "status_verificacion": "no_verificado",
            "confianza_global": 0.95,
            "ultima_extraccion_id": None,
            "total_confirmaciones": 0,
            "total_reportes": 0,
            "created_at": now,
            "updated_at": now,
            "origen": "excel",
        }
        await db.collection("pacientes").document(paciente_id).set(paciente_data_fs)
        logger.info("Paciente creado desde Excel: %s", nombre)
    else:
        await db.collection("pacientes").document(paciente_id).update({
            "updated_at": now,
        })

    return paciente_id


def _parsear_edad(valor: str | None) -> int | None:
    if not valor:
        return None
    match = re.search(r"(\d+)", str(valor))
    if match:
        return int(match.group(1))
    return None


def _normalizar_cedula(cedula: str) -> str:
    return "".join(c for c in str(cedula) if c.isdigit()) if cedula else ""


async def _get_engine_from_firestore(db) -> str:
    """Lee el motor configurado desde Firestore (admin panel)."""
    try:
        doc = await db.collection("_config").document("settings").get()
        if doc.exists:
            return doc.to_dict().get("extraction_engine", settings.extraction_engine)
    except Exception:
        pass
    return settings.extraction_engine


async def _registrar_upload(
    db: AsyncFirestoreClient,
    gs_url: str | None,
    paciente_ids: list[str],
    motor: str,
    hospitales: list[str],
) -> None:
    """Registra un upload en la colección uploads para trackeo."""
    if not gs_url:
        return
    try:
        upload_id = uuid.uuid4().hex
        await db.collection("uploads").document(upload_id).set({
            "id": upload_id,
            "imagen_gs_url": gs_url,
            "paciente_ids": paciente_ids,
            "motor": motor,
            "hospitales": hospitales,
            "total_pacientes": len(paciente_ids),
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as exc:
        logger.warning("No se pudo registrar upload: %s", exc)


async def _get_contexto_from_firestore(db) -> str:
    """Lee el contexto del listado desde Firestore (admin panel)."""
    try:
        doc = await db.collection("_config").document("settings").get()
        if doc.exists:
            return doc.to_dict().get("contexto", "")
    except Exception:
        pass
    return ""
