"""Consulta de impacto de un periodo (CMP-05 · #20 · RF-018, RF-019, RF-020).

Los totales se calculan siempre desde `rescates`: no hay tablas de totales mantenidas a mano.
Solo cuentan los rescates en estado `entregado` cuya entrega cae en [desde, hasta).
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

# Colombia no tiene horario de verano: UTC-5 todo el año.
ZONA_COLOMBIA = timezone(timedelta(hours=-5), "America/Bogota")

CONSULTA_IMPACTO = text(
    """
    SELECT
        COALESCE(SUM(cantidad_recibida) FILTER (WHERE unidad_recibida = 'kg'), 0) AS kilogramos,
        COALESCE(SUM(cantidad_recibida) FILTER (WHERE unidad_recibida = 'aproximada'), 0)
            AS kilogramos_estimados,
        COALESCE(SUM(personas_beneficiadas), 0) AS personas_beneficiadas,
        COUNT(DISTINCT organizacion_id) AS organizaciones,
        COUNT(*) AS rescates_entregados,
        COUNT(*) FILTER (WHERE es_medida IS NOT TRUE) AS rescates_estimados
    FROM rescates
    WHERE estado = 'entregado'
      AND entregado_en >= :desde
      AND entregado_en < :hasta
    """
)


@dataclass(frozen=True)
class TotalesImpacto:
    # CA-05.1: los tres indicadores.
    kilogramos: Decimal
    personas_beneficiadas: int
    organizaciones: int
    # Para el aviso de cantidades estimadas del diseño (#19): no se suman a `kilogramos`.
    kilogramos_estimados: Decimal
    rescates_entregados: int
    rescates_estimados: int


def rango_de_fechas(desde: date, hasta: date) -> tuple[datetime, datetime]:
    """Convierte días de calendario de Colombia, ambos incluidos, en el intervalo [desde, hasta)."""
    if hasta < desde:
        raise ValueError("La fecha final no puede ser anterior a la inicial")
    inicio = datetime.combine(desde, time.min, ZONA_COLOMBIA)
    fin = datetime.combine(hasta + timedelta(days=1), time.min, ZONA_COLOMBIA)
    return inicio, fin


def calcular_impacto(db: Session, desde: datetime, hasta: datetime) -> TotalesImpacto:
    """Totales de los rescates entregados con `desde <= entregado_en < hasta`."""
    if desde.tzinfo is None or hasta.tzinfo is None:
        raise ValueError("Las fechas del periodo deben incluir zona horaria")
    if desde >= hasta:
        raise ValueError("El inicio del periodo debe ser anterior a su fin")

    fila = db.execute(CONSULTA_IMPACTO, {"desde": desde, "hasta": hasta}).one()
    return TotalesImpacto(
        kilogramos=Decimal(fila.kilogramos),
        personas_beneficiadas=int(fila.personas_beneficiadas),
        organizaciones=int(fila.organizaciones),
        kilogramos_estimados=Decimal(fila.kilogramos_estimados),
        rescates_entregados=int(fila.rescates_entregados),
        rescates_estimados=int(fila.rescates_estimados),
    )
