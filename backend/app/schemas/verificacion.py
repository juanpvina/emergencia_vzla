from datetime import datetime
from pydantic import BaseModel, Field


class VerificacionCreate(BaseModel):
    tipo: str = Field(..., pattern=r"^(confirmar|reportar_error)$")
    verificador_id: str = Field(..., max_length=64)
    comentario: str | None = Field(None, max_length=500)


class VerificacionRead(BaseModel):
    id: str
    paciente_id: str
    verificador_id: str
    tipo: str
    comentario: str | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class VerificacionStats(BaseModel):
    paciente_id: str
    status_verificacion: str
    total_confirmaciones: int = 0
    total_reportes: int = 0
