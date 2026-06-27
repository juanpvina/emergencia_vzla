import logging
import uuid
from datetime import datetime, timezone
from google.cloud.firestore_v1.async_client import AsyncClient as AsyncFirestoreClient
from google.cloud.firestore_v1.base_query import FieldFilter
from app.schemas.paciente import PacienteDetail, PacienteList, PacienteRead, PacienteCreate

logger = logging.getLogger(__name__)


def _normalizar_cedula(cedula: str) -> str:
    return "".join(c for c in cedula if c.isdigit())


def _doc_to_paciente_read(doc) -> PacienteRead:
    data = doc.to_dict() if hasattr(doc, "to_dict") else doc
    return PacienteRead(
        id=data.get("id", doc.id if hasattr(doc, "id") else ""),
        nombre=data.get("nombre", ""),
        cedula=data.get("cedula"),
        hospital=data.get("hospital"),
        piso=data.get("piso"),
        habitacion=data.get("habitacion"),
        edad=data.get("edad"),
        estado_salud=data.get("estado_salud"),
        contacto=data.get("contacto"),
        foto_url=data.get("foto_url"),
        status_verificacion=data.get("status_verificacion", "no_verificado"),
        confianza_global=data.get("confianza_global"),
        ultima_extraccion_id=data.get("ultima_extraccion_id"),
        created_at=data.get("created_at"),
        updated_at=data.get("updated_at"),
    )


async def listar_pacientes(
    db: AsyncFirestoreClient, limit: int = 20, offset: int = 0
) -> PacienteList:
    pacientes_ref = db.collection("pacientes")
    count_docs = [d async for d in pacientes_ref.select(["id"]).stream()]
    total = len(count_docs)
    query = pacientes_ref.order_by("created_at", direction="DESCENDING").limit(limit)
    docs = [d async for d in query.stream()]
    docs = docs[offset:offset + limit] if offset else docs[:limit]

    items = [_doc_to_paciente_read(d) for d in docs]
    return PacienteList(items=items, total=total, limit=limit, offset=offset)


async def obtener_paciente(
    db: AsyncFirestoreClient, paciente_id: str
) -> PacienteDetail | None:
    doc = await db.collection("pacientes").document(paciente_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    detail = PacienteDetail(
        id=data.get("id", doc.id),
        nombre=data.get("nombre", ""),
        cedula=data.get("cedula"),
        hospital=data.get("hospital"),
        piso=data.get("piso"),
        habitacion=data.get("habitacion"),
        edad=data.get("edad"),
        estado_salud=data.get("estado_salud"),
        contacto=data.get("contacto"),
        foto_url=data.get("foto_url"),
        status_verificacion=data.get("status_verificacion", "no_verificado"),
        confianza_global=data.get("confianza_global"),
        ultima_extraccion_id=data.get("ultima_extraccion_id"),
        created_at=data.get("created_at"),
        updated_at=data.get("updated_at"),
        total_confirmaciones=data.get("total_confirmaciones", 0),
        total_reportes=data.get("total_reportes", 0),
    )
    return detail


async def obtener_paciente_por_cedula(
    db: AsyncFirestoreClient, cedula: str
) -> PacienteRead | None:
    cedula_limpia = _normalizar_cedula(cedula)
    if not cedula_limpia:
        return None
    docs = db.collection("pacientes").where(filter=FieldFilter("cedula", "==", cedula_limpia)).limit(1)
    results = [d async for d in docs.stream()]
    if results:
        return _doc_to_paciente_read(results[0])
    return None


async def buscar_por_nombre(
    db: AsyncFirestoreClient, nombre: str, limit: int = 20, offset: int = 0
) -> PacienteList:
    nombre_lower = nombre.lower().strip()
    tokens = [t for t in nombre_lower.split() if t]

    pacientes_ref = db.collection("pacientes")
    all_docs = {}
    for token in tokens:
        query = pacientes_ref.where(
            filter=FieldFilter("nombre_tokens", "array_contains", token)
        )
        async for doc in query.stream():
            all_docs[doc.id] = doc

    sorted_docs = sorted(
        all_docs.values(),
        key=lambda d: d.to_dict().get("created_at", datetime.min.replace(tzinfo=timezone.utc)),
        reverse=True,
    )

    total = len(sorted_docs)
    paginated = sorted_docs[offset:offset + limit]

    return PacienteList(
        items=[_doc_to_paciente_read(d) for d in paginated],
        total=total,
        limit=limit,
        offset=offset,
    )


async def busqueda_global(
    db: AsyncFirestoreClient, q: str, limit: int = 20, offset: int = 0
) -> PacienteList:
    cedula_normalizada = _normalizar_cedula(q)
    resultados = {}

    if cedula_normalizada:
        docs = db.collection("pacientes").where(
            filter=FieldFilter("cedula", "==", cedula_normalizada)
        ).limit(limit)
        async for doc in docs.stream():
            resultados[doc.id] = doc

    nombre_lower = q.lower().strip()
    tokens = [t for t in nombre_lower.split() if t]
    for token in tokens:
        query = db.collection("pacientes").where(
            filter=FieldFilter("nombre_tokens", "array_contains", token)
        )
        async for doc in query.stream():
            resultados[doc.id] = doc

    sorted_docs = sorted(
        resultados.values(),
        key=lambda d: d.to_dict().get("created_at", datetime.min.replace(tzinfo=timezone.utc)),
        reverse=True,
    )

    total = len(sorted_docs)
    paginated = sorted_docs[offset:offset + limit]

    return PacienteList(
        items=[_doc_to_paciente_read(d) for d in paginated],
        total=total,
        limit=limit,
        offset=offset,
    )


async def crear_paciente_manual(
    db: AsyncFirestoreClient, data: PacienteCreate
) -> PacienteRead:
    paciente_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)

    nombre_lower = data.nombre.lower().strip()
    nombre_tokens = [t for t in nombre_lower.split() if t]

    doc_data = {
        "id": paciente_id,
        "nombre": data.nombre,
        "cedula": _normalizar_cedula(data.cedula) if data.cedula else None,
        "nombre_lower": nombre_lower,
        "nombre_tokens": nombre_tokens,
        "hospital": data.hospital,
        "piso": data.piso,
        "habitacion": data.habitacion,
        "estado_salud": data.estado_salud,
        "edad": data.edad,
        "contacto": data.contacto,
        "foto_url": None,
        "status_verificacion": "no_verificado",
        "confianza_global": 1.0,
        "ultima_extraccion_id": None,
        "total_confirmaciones": 0,
        "total_reportes": 0,
        "created_at": now,
        "updated_at": now,
        "origen": "manual",
    }

    await db.collection("pacientes").document(paciente_id).set(doc_data)
    return _doc_to_paciente_read(doc_data)


async def obtener_extracciones(
    db: AsyncFirestoreClient, paciente_id: str
) -> list:
    extracciones_ref = db.collection("pacientes").document(paciente_id).collection("extracciones")
    docs = extracciones_ref.order_by("created_at", direction="DESCENDING")
    resultados = []
    async for doc in docs.stream():
        data = doc.to_dict()
        resultados.append({
            "id": data.get("id", doc.id),
            "imagen_original": data.get("imagen_gs_url", ""),
            "modelo_vlm": data.get("modelo_vlm", ""),
            "conf_global": data.get("conf_global"),
            "es_completo": data.get("es_completo", True),
            "created_at": data.get("created_at"),
        })
    return resultados


async def ruta_imagen_paciente(
    db: AsyncFirestoreClient, paciente_id: str
) -> str | None:
    extracciones_ref = db.collection("pacientes").document(paciente_id).collection("extracciones")
    docs = extracciones_ref.order_by("created_at", direction="DESCENDING").limit(1)
    async for doc in docs.stream():
        return doc.to_dict().get("imagen_gs_url")
    return None
