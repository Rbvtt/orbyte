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

CONSULTA_ORGANIZACIONES = text(
    """
    SELECT DISTINCT o.id, o.nombre
    FROM rescates r
    JOIN organizaciones_receptoras o ON o.id = r.organizacion_id
    WHERE r.estado = 'entregado'
      AND r.entregado_en >= :desde
      AND r.entregado_en < :hasta
    ORDER BY o.nombre, o.id
    """
)

_FILTROS_DETALLE = {
    "kg": "r.unidad_recibida = 'kg'",
    "personas": "r.personas_beneficiadas IS NOT NULL",
    "organizaciones": "TRUE",
    "sin_kg": "r.es_medida IS NOT TRUE",
}


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


def listar_organizaciones_impacto(
    db: Session, desde: datetime, hasta: datetime
) -> list[dict]:
    filas = db.execute(
        CONSULTA_ORGANIZACIONES, {"desde": desde, "hasta": hasta}
    ).mappings()
    return [{"id": fila["id"], "nombre": fila["nombre"]} for fila in filas]


def listar_rescates_detalle_impacto(
    db: Session, desde: datetime, hasta: datetime, metrica: str
) -> list[dict]:
    filtro = _FILTROS_DETALLE.get(metrica)
    if filtro is None:
        raise ValueError("Métrica de impacto no válida")

    consulta = text(
        f"""
        SELECT
            r.id,
            r.entregado_en,
            c.nombre AS comercio,
            o.id AS organizacion_id,
            o.nombre AS organizacion,
            r.cantidad_recibida,
            r.unidad_recibida,
            r.es_medida,
            r.personas_beneficiadas
        FROM rescates r
        JOIN comercios c ON c.id = r.comercio_id
        JOIN organizaciones_receptoras o ON o.id = r.organizacion_id
        WHERE r.estado = 'entregado'
          AND r.entregado_en >= :desde
          AND r.entregado_en < :hasta
          AND {filtro}
        ORDER BY r.entregado_en, r.id
        """
    )
    return [
        dict(fila)
        for fila in db.execute(
            consulta, {"desde": desde, "hasta": hasta}
        ).mappings()
    ]
