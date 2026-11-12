from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class OrganizacionImpactoOut(BaseModel):
    id: UUID
    nombre: str


class ImpactoOut(BaseModel):
    kg_total: float
    personas_total: int
    organizaciones: list[OrganizacionImpactoOut]
    rescates_sin_kg: int


class RescateImpactoDetalleOut(BaseModel):
    id: UUID
    entregado_en: datetime
    comercio: str
    organizacion_id: UUID
    organizacion: str
    cantidad_recibida: float
    unidad_recibida: Literal["kg", "aproximada"]
    es_medida: bool
    personas_beneficiadas: int | None
    valor: float | int | None


class OrganizacionImpactoDetalleOut(BaseModel):
    id: UUID
    nombre: str
    valor: int
    rescates: list[RescateImpactoDetalleOut]


class ImpactoDetalleOut(BaseModel):
    metrica: Literal["kg", "personas", "organizaciones", "sin_kg"]
    total: float | int
    rescates: list[RescateImpactoDetalleOut]
    organizaciones: list[OrganizacionImpactoDetalleOut] = Field(default_factory=list)
