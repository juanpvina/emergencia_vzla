import logging
import uuid
from datetime import datetime, timedelta, timezone

from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient
from google.cloud.firestore_v1.base_query import FieldFilter

from app.schemas.verificacion import VerificacionCreate, VerificacionRead, VerificacionStats

logger = logging.getLogger(__name__)

CONFIRMACIONES_PARA_PARCIAL = 1
CONFIRMACIONES_PARA_VERIFICADO = 3


async def registrar_voto(
    db: AsyncFirestoreClient, paciente_id: str, voto: VerificacionCreate
) -> VerificacionStats:
    paciente_ref = db.collection("pacientes").document(paciente_id)
    paciente_doc = await paciente_ref.get()

    if not paciente_doc.exists:
        raise ValueError("Paciente no encontrado")

    verificacion_ref = paciente_ref.collection("verificaciones").document(voto.verificador_id)
    verificacion_doc = await verificacion_ref.get()
    if verificacion_doc.exists:
        raise ValueError("Ya has votado sobre este paciente")

    now = datetime.now(timezone.utc)

    await verificacion_ref.set({
        "verificador_id": voto.verificador_id,
        "tipo": voto.tipo,
        "comentario": voto.comentario,
        "created_at": now,
    })

    paciente_data = paciente_doc.to_dict()
    if voto.tipo == "confirmar":
        new_confirmaciones = paciente_data.get("total_confirmaciones", 0) + 1
        new_reportes = paciente_data.get("total_reportes", 0)
    else:
        new_confirmaciones = paciente_data.get("total_confirmaciones", 0)
        new_reportes = paciente_data.get("total_reportes", 0) + 1

    if new_reportes > 0:
        nuevo_estado = "error"
    elif new_confirmaciones >= CONFIRMACIONES_PARA_VERIFICADO:
        nuevo_estado = "verificado"
    elif new_confirmaciones >= CONFIRMACIONES_PARA_PARCIAL:
        nuevo_estado = "parcial"
    else:
        nuevo_estado = "no_verificado"

    await paciente_ref.update({
        "total_confirmaciones": new_confirmaciones,
        "total_reportes": new_reportes,
        "status_verificacion": nuevo_estado,
        "updated_at": now,
    })

    return VerificacionStats(
        paciente_id=paciente_id,
        status_verificacion=nuevo_estado,
        total_confirmaciones=new_confirmaciones,
        total_reportes=new_reportes,
    )


async def obtener_votos(
    db: AsyncFirestoreClient, paciente_id: str
) -> list[VerificacionRead]:
    verificaciones_ref = db.collection("pacientes").document(paciente_id).collection("verificaciones")
    docs = verificaciones_ref.order_by("created_at", direction="DESCENDING")

    votos = []
    async for doc in docs.stream():
        data = doc.to_dict()
        votos.append(VerificacionRead(
            id=data.get("verificador_id", doc.id),
            paciente_id=paciente_id,
            verificador_id=data.get("verificador_id", ""),
            tipo=data.get("tipo", ""),
            comentario=data.get("comentario"),
            created_at=data.get("created_at"),
        ))
    return votos


async def obtener_stats(
    db: AsyncFirestoreClient, paciente_id: str
) -> VerificacionStats:
    paciente_doc = await db.collection("pacientes").document(paciente_id).get()
    if not paciente_doc.exists:
        raise ValueError("Paciente no encontrado")

    data = paciente_doc.to_dict()
    return VerificacionStats(
        paciente_id=paciente_id,
        status_verificacion=data.get("status_verificacion", "no_verificado"),
        total_confirmaciones=data.get("total_confirmaciones", 0),
        total_reportes=data.get("total_reportes", 0),
    )
