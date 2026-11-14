from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_role
from app.schemas.impacto import (
    ImpactoDetalleOut,
    ImpactoOut,
    OrganizacionImpactoDetalleOut,
)
from app.services.impacto import (
    calcular_impacto,
    listar_organizaciones_impacto,
    listar_rescates_detalle_impacto,
    rango_de_fechas,
)


router = APIRouter(prefix="/api/v1/impacto", tags=["impacto"])


def _rango(desde: date, hasta: date) -> tuple[datetime, datetime]:
    try:
        return rango_de_fechas(desde, hasta)
    except (OverflowError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from None


@router.get("", response_model=ImpactoOut)
def get_impacto(
    desde: date,
    hasta: date,
    _current_user: CurrentUser = Depends(require_role("administrador")),
    db: Session = Depends(get_db),
) -> ImpactoOut:
    inicio, fin = _rango(desde, hasta)
    totales = calcular_impacto(db, inicio, fin)
    organizaciones = listar_organizaciones_impacto(db, inicio, fin)
    return ImpactoOut(
        kg_total=float(totales.kilogramos),
        personas_total=totales.personas_beneficiadas,
        organizaciones=organizaciones,
        rescates_sin_kg=totales.rescates_estimados,
    )


@router.get("/detalle", response_model=ImpactoDetalleOut)
def get_detalle_impacto(
    desde: date,
    hasta: date,
    metrica: Literal["kg", "personas", "organizaciones", "sin_kg"],
    _current_user: CurrentUser = Depends(require_role("administrador")),
    db: Session = Depends(get_db),
) -> ImpactoDetalleOut:
    inicio, fin = _rango(desde, hasta)
    totales = calcular_impacto(db, inicio, fin)
    rescates = listar_rescates_detalle_impacto(db, inicio, fin, metrica)
    total = {
        "kg": float(totales.kilogramos),
        "personas": totales.personas_beneficiadas,
        "organizaciones": totales.organizaciones,
        "sin_kg": totales.rescates_estimados,
    }[metrica]
    if metrica == "organizaciones":
        agrupadas = {}
        for rescate in rescates:
            organizacion = agrupadas.setdefault(
                rescate["organizacion_id"],
                {
                    "id": rescate["organizacion_id"],
                    "nombre": rescate["organizacion"],
                    "valor": 1,
                    "rescates": [],
                },
            )
            rescate["valor"] = None
            organizacion["rescates"].append(rescate)
        organizaciones = [
            OrganizacionImpactoDetalleOut.model_validate(organizacion)
            for organizacion in agrupadas.values()
        ]
        return ImpactoDetalleOut(
            metrica=metrica,
            total=total,
            rescates=[],
            organizaciones=organizaciones,
        )

    for rescate in rescates:
        rescate["valor"] = {
            "kg": rescate["cantidad_recibida"],
            "personas": rescate["personas_beneficiadas"],
            "sin_kg": 1,
        }[metrica]
    return ImpactoDetalleOut(
        metrica=metrica,
        total=total,
        rescates=rescates,
        organizaciones=[],
    )
