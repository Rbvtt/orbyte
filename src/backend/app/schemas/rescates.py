from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import RescateEstado


class RescateCreate(BaseModel):
    comercio_id: UUID
    alimento: str = Field(min_length=1)
    cantidad_aprox: str = Field(min_length=1)
    lugar_recogida: str = Field(min_length=1)
    hora_limite: datetime
    observaciones: str | None = None

    @field_validator("alimento", "cantidad_aprox", "lugar_recogida", mode="before")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        return value.strip()

    @field_validator("observaciones", mode="before")
    @classmethod
    def normalize_observaciones(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value or None

    @field_validator("hora_limite")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("La hora_limite debe incluir zona horaria")
        return value


class RescateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    comercio_id: UUID
    alimento: str
    cantidad_aprox: str
    lugar_recogida: str
    hora_limite: datetime
    observaciones: str | None
    estado: RescateEstado
    registrado_por: UUID
    creado_en: datetime


class RescateAsignacionIn(BaseModel):
    organizacion_id: UUID
    voluntario_id: UUID


class RescateAsignacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    estado: RescateEstado
    organizacion_id: UUID
    voluntario_id: UUID
    asignado_en: datetime
    asignado_por: UUID


class OrganizacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    capacidad_kg: float | None
    refrigeracion: bool
    horario_recepcion: str | None


class VoluntarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    medio_transporte: str | None
    disponibilidad: str | None


class RescateListaOut(BaseModel):
    id: UUID
    estado: RescateEstado
    hora_limite: datetime
    comercio: str
    organizacion: str | None
    voluntario: str | None
    pendiente_asignar: bool


class RescateDetalleOut(BaseModel):
    id: UUID
    estado: RescateEstado
    hora_limite: datetime | None = None
    pendiente_asignar: bool
    comercio: str | None = None
    alimento: str | None = None
    cantidad_aprox: str | None = None
    lugar_recogida: str | None = None
    lugar_entrega: str | None = None
    organizacion: str | None = None
    voluntario: str | None = None
    asignado_en: datetime | None
    asignado_por: UUID | None = None
    observaciones: str | None = None
