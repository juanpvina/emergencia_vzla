import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CampoExtraido(BaseModel):
    """Representa un campo extraído con su valor, confianza y texto original."""
    valor: str | None = None
    confianza: float | None = Field(None, ge=0.0, le=1.0)
    raw_text: str | None = None


class PacienteExtraido(BaseModel):
    """Paciente extraído por Gemini. Todos los campos son opcionales."""
    nombre: CampoExtraido | None = None
    cedula: CampoExtraido | None = None
    hospital: CampoExtraido | None = None
    piso: CampoExtraido | None = None
    habitacion: CampoExtraido | None = None
    edad: CampoExtraido | None = None
    estado_salud: CampoExtraido | None = None
    contacto: CampoExtraido | None = None
    notas: str | None = None


class GeminiResponse(BaseModel):
    """Estructura completa de la respuesta de Gemini (versión simplificada)."""
    pacientes: list[PacienteExtraido] = []
    advertencias: list[str] = []


class ExtraccionRead(BaseModel):
    id: str
    paciente_id: str
    imagen_original: str
    modelo_vlm: str
    raw_output: dict
    conf_global: float | None
    es_completo: bool
    razon_parcial: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExtraccionResult(BaseModel):
    """Respuesta tras procesar una imagen."""
    pacientes_creados: list[str] = []
    total_pacientes: int = 0
    advertencias: list[str] = []
    raw_respuesta: GeminiResponse | None = None
