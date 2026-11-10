import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import RescateEstado


class ComercioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    direccion: str
    telefono: str | None


class RescateDatos(BaseModel):
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
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("El campo es obligatorio")
        return cleaned

    @field_validator("cantidad_aprox")
    @classmethod
    def validate_cantidad(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("La cantidad debe ser un número mayor que cero")
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("La cantidad es obligatoria")
        match = re.search(r"[-+]?\d*\.?\d+", cleaned)
        if match is None:
            raise ValueError("La cantidad debe ser un número mayor que cero")
        try:
            cantidad = Decimal(match.group(0))
        except InvalidOperation as exc:
            raise ValueError("La cantidad debe ser un número mayor que cero") from exc
        if cantidad <= 0:
            raise ValueError("La cantidad debe ser mayor que cero")
        return cleaned

    @field_validator("observaciones", mode="before")
    @classmethod
    def normalize_observaciones(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
        return value or None

    @field_validator("hora_limite")
    @classmethod
    def require_timezone_and_future(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("La hora_limite debe incluir zona horaria")
        if value <= datetime.now(timezone.utc):
            raise ValueError("La hora_limite debe ser futura")
        return value


class RescateCreate(RescateDatos):
    comercio_id: UUID


class RescateUpdate(RescateDatos):
    pass


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


class RescateComercioOut(RescateOut):
    motivo_no_completado: str | None = None


class RescateAsignacionIn(BaseModel):
    organizacion_id: UUID
    voluntario_id: UUID
    motivo: str | None = None


class RescateAsignacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    estado: RescateEstado
    organizacion_id: UUID
    voluntario_id: UUID
    asignado_en: datetime
    asignado_por: UUID


class RescateNoCompletadoIn(BaseModel):
    motivo: str = Field(min_length=1, max_length=2000)

    @field_validator("motivo", mode="before")
    @classmethod
    def normalize_motivo(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("El motivo es obligatorio")
        return cleaned


class RescateNoCompletadoOut(RescateOut):
    motivo_no_completado: str


class RescateHistorialOut(BaseModel):
    id: int
    estado_anterior: RescateEstado | None
    estado_nuevo: RescateEstado
    ocurrido_en: datetime
    actor_id: UUID
    actor_nombre: str
    actor_rol: str
    detalle: dict


class RescateRecepcionIn(BaseModel):
    cantidad_recibida: float = Field(gt=0)
    es_medida: bool
    unidad_recibida: Literal["kg", "aproximada"]
    personas_beneficiadas: int | None = Field(default=None, ge=0)

    @field_validator("unidad_recibida")
    @classmethod
    def unidad_consistente_con_medicion(
        cls, value: Literal["kg", "aproximada"], info
    ) -> Literal["kg", "aproximada"]:
        es_medida = info.data.get("es_medida")
        if es_medida is not None and (value == "kg") != es_medida:
            raise ValueError("La unidad debe coincidir con el tipo de cantidad")
        return value


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
    origen_aviso: str
    fundacion: str | None = None
    lugar_recogida: str | None = None
    lugar_entrega: str | None = None
    cantidad_aprox: str | None = None
    estado_visual: str | None = None


class RescateDetalleOut(BaseModel):
    id: UUID
    estado: RescateEstado
    estado_visual: str | None = None
    organizacion_id: UUID | None = None
    voluntario_id: UUID | None = None
    hora_limite: datetime | None = None
    pendiente_asignar: bool
    comercio: str | None = None
    alimento: str | None = None
    cantidad_aprox: str | None = None
    lugar_recogida: str | None = None
    lugar_entrega: str | None = None
    organizacion: str | None = None
    voluntario: str | None = None
    fundacion: str | None = None
    asignado_en: datetime | None
    asignado_por: UUID | None = None
    observaciones: str | None = None
    origen_aviso: str | None = None
    motivo_no_completado: str | None = None
