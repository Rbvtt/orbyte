"""Servicio único de transición de estado de un rescate (#35 · CA-03.3, RF-014, RF-015, RNF-011).

Todo endpoint que cambie el estado de un rescate usa `cambiar_estado()`: hace el UPDATE
condicional sobre `rescates` y el INSERT en `historial_estados` en la misma transacción.
"""

import json
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import RescateEstado

# Columnas de `rescates` que una transición puede escribir o exigir. Se validan porque sus
# nombres se insertan en el SQL; los valores siempre van como parámetros.
COLUMNAS_PERMITIDAS = frozenset(
    {"organizacion_id", "voluntario_id", "asignado_por", "recibido_por", "cantidad_recibida",
     "unidad_recibida", "es_medida", "personas_beneficiadas", "motivo_no_completado"}
)
MARCAS_DE_TIEMPO = frozenset({"asignado_en", "recogido_en", "entregado_en"})


def cambiar_estado(
    db: Session,
    rescate_id: UUID,
    desde: RescateEstado,
    hacia: RescateEstado,
    actor_id: UUID,
    cambios: dict | None = None,
    condiciones: dict | None = None,
    marca_tiempo: str | None = None,
    detalle: dict | None = None,
) -> bool:
    """Pasa el rescate de `desde` a `hacia` y deja exactamente una fila de historial.

    - `cambios`: otras columnas que se escriben junto con el estado.
    - `condiciones`: columnas que además deben coincidir (valor None = `IS NULL`).
    - `marca_tiempo`: columna de fecha que se fija con `now()`.

    Devuelve False si el rescate no estaba en `desde` (o no cumplía las condiciones): en ese
    caso no se modifica nada. Si falla el INSERT del historial, el cambio de estado se revierte.
    El commit lo hace quien llama.
    """
    cambios = cambios or {}
    condiciones = condiciones or {}
    if not (set(cambios) | set(condiciones)) <= COLUMNAS_PERMITIDAS:
        raise ValueError("Columna no permitida en una transición.")
    if marca_tiempo is not None and marca_tiempo not in MARCAS_DE_TIEMPO:
        raise ValueError("Marca de tiempo no permitida en una transición.")

    sets = ["estado = CAST(:hacia AS rescate_estado)"] + [f"{c} = :set_{c}" for c in sorted(cambios)]
    if marca_tiempo:
        sets.append(f"{marca_tiempo} = now()")
    where = ["id = :id", "estado = CAST(:desde AS rescate_estado)"]
    for c in sorted(condiciones):
        where.append(f"{c} IS NULL" if condiciones[c] is None else f"{c} = :cond_{c}")

    parametros = {"id": rescate_id, "desde": desde.value, "hacia": hacia.value}
    parametros.update({f"set_{c}": v for c, v in cambios.items()})
    parametros.update({f"cond_{c}": v for c, v in condiciones.items() if v is not None})

    # Punto de guardado: el UPDATE y el INSERT se confirman juntos o no queda ninguno.
    with db.begin_nested():
        fila = db.execute(
            text(f"UPDATE rescates SET {', '.join(sets)} WHERE {' AND '.join(where)} RETURNING id"),
            parametros,
        ).first()
        if fila is None:
            return False
        db.execute(
            text(
                "INSERT INTO historial_estados (rescate_id, estado_anterior, estado_nuevo, actor_id, detalle) "
                "VALUES (:rescate_id, CAST(:anterior AS rescate_estado), CAST(:nuevo AS rescate_estado), "
                ":actor_id, CAST(:detalle AS jsonb))"
            ),
            {"rescate_id": rescate_id, "anterior": desde.value, "nuevo": hacia.value,
             "actor_id": actor_id, "detalle": json.dumps(detalle or {})},
        )
    return True
