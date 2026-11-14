"""#35 · historial_estados append-only y servicio único cambiar_estado() (CA-03.3, RNF-011).

Criterios técnicos:
- Cada transición genera exactamente una fila.
- Si falla el INSERT de historial se revierte el cambio de estado.
- UPDATE o DELETE sobre historial_estados falla.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.models import (
    Comercio,
    OrganizacionReceptora,
    Rescate,
    RescateEstado,
    RescateHistorial,
    Usuario,
    UsuarioEstado,
    UsuarioRol,
    Voluntario,
)
from app.services.rescates import ConflictoAsignacion, asignar_rescate_con_historial
from app.services.transiciones import cambiar_estado


def _usuario(rol: UsuarioRol, **extra) -> Usuario:
    return Usuario(
        id=uuid4(),
        nombre=f"{rol.value} de prueba",
        email=f"{uuid4()}@example.com",
        password_hash="irrelevante",
        rol=rol,
        activo=True,
        estado=UsuarioEstado.APROBADO,
        **extra,
    )


def _escenario(db):
    comercio = Comercio(nombre=f"Comercio {uuid4()}", direccion="Calle 1")
    organizacion = OrganizacionReceptora(nombre=f"Organización {uuid4()}", direccion="Calle 2")
    db.add_all([comercio, organizacion])
    db.flush()
    fundacion = _usuario(UsuarioRol.FUNDACION)
    receptora = _usuario(UsuarioRol.ORGANIZACION, organizacion_id=organizacion.id)
    voluntario = _usuario(UsuarioRol.VOLUNTARIO)
    otro_voluntario = _usuario(UsuarioRol.VOLUNTARIO)
    db.add_all([fundacion, receptora, voluntario, otro_voluntario])
    db.flush()
    db.add_all([Voluntario(usuario_id=voluntario.id), Voluntario(usuario_id=otro_voluntario.id)])
    rescate = Rescate(
        comercio_id=comercio.id,
        alimento="Pan",
        cantidad_aprox="20 unidades",
        lugar_recogida="Calle 1",
        hora_limite=datetime.now(timezone.utc) + timedelta(days=1),
        registrado_por=fundacion.id,
        estado=RescateEstado.DISPONIBLE,
    )
    db.add(rescate)
    db.commit()
    return {
        "rescate": rescate.id,
        "organizacion": organizacion.id,
        "fundacion": fundacion.id,
        "voluntario": voluntario.id,
        "otro_voluntario": otro_voluntario.id,
    }


def _filas(db, rescate_id) -> int:
    return db.scalar(
        select(func.count()).select_from(RescateHistorial).where(RescateHistorial.rescate_id == rescate_id)
    )


def _estado(db, rescate_id) -> RescateEstado:
    return db.scalar(select(Rescate.estado).where(Rescate.id == rescate_id).execution_options(populate_existing=True))


def test_cada_transicion_genera_exactamente_una_fila(real_db):
    datos = _escenario(real_db)

    assert cambiar_estado(
        real_db,
        datos["rescate"],
        RescateEstado.DISPONIBLE,
        RescateEstado.NO_COMPLETADO,
        datos["fundacion"],
        cambios={"motivo_no_completado": "Sin voluntarios"},
        detalle={"motivo": "Sin voluntarios"},
    )
    real_db.commit()

    fila = real_db.scalars(select(RescateHistorial).where(RescateHistorial.rescate_id == datos["rescate"])).one()
    assert fila.estado_anterior == RescateEstado.DISPONIBLE
    assert fila.estado_nuevo == RescateEstado.NO_COMPLETADO
    assert fila.cambiado_por == datos["fundacion"]
    assert fila.cambiado_en is not None
    assert fila.detalle == {"motivo": "Sin voluntarios"}

    # Una transición que no aplica (el rescate ya no está disponible) no cambia nada ni deja fila.
    assert not cambiar_estado(
        real_db, datos["rescate"], RescateEstado.DISPONIBLE, RescateEstado.ASIGNADO, datos["fundacion"]
    )
    real_db.commit()
    assert _filas(real_db, datos["rescate"]) == 1
    assert _estado(real_db, datos["rescate"]) == RescateEstado.NO_COMPLETADO


def test_asignacion_y_reasignacion_usan_el_servicio_y_dejan_historial(real_db):
    datos = _escenario(real_db)

    rescate = asignar_rescate_con_historial(
        real_db, datos["rescate"], datos["voluntario"], datos["organizacion"], datos["fundacion"]
    )
    assert rescate.estado == RescateEstado.ASIGNADO
    assert rescate.asignado_en is not None
    assert _filas(real_db, datos["rescate"]) == 1

    # Segunda asignación (CA-02.2): un rescate asignado no se reasigna; 409 y ninguna fila nueva.
    with pytest.raises(ConflictoAsignacion):
        asignar_rescate_con_historial(
            real_db, datos["rescate"], datos["otro_voluntario"], datos["organizacion"], datos["fundacion"]
        )
    assert _filas(real_db, datos["rescate"]) == 1

    asignar_rescate_con_historial(
        real_db,
        datos["rescate"],
        datos["otro_voluntario"],
        datos["organizacion"],
        datos["fundacion"],
        motivo="El voluntario no puede ir",
        solo_reasignar=True,
    )
    filas = real_db.scalars(
        select(RescateHistorial)
        .where(RescateHistorial.rescate_id == datos["rescate"])
        .order_by(RescateHistorial.id)
    ).all()
    assert [(f.estado_anterior, f.estado_nuevo) for f in filas] == [
        (RescateEstado.DISPONIBLE, RescateEstado.ASIGNADO),
        (RescateEstado.ASIGNADO, RescateEstado.ASIGNADO),
    ]
    assert filas[1].detalle["motivo"] == "El voluntario no puede ir"
    assert filas[0].cambiado_por == datos["fundacion"]
    assert real_db.scalar(select(Rescate.voluntario_id).where(Rescate.id == datos["rescate"])) == datos["otro_voluntario"]


def test_si_falla_el_insert_del_historial_se_revierte_el_cambio_de_estado(real_db):
    datos = _escenario(real_db)

    # actor_id inexistente: el UPDATE pasa, pero el INSERT del historial viola la llave foránea.
    with pytest.raises(IntegrityError):
        cambiar_estado(
            real_db,
            datos["rescate"],
            RescateEstado.DISPONIBLE,
            RescateEstado.NO_COMPLETADO,
            uuid4(),
            cambios={"motivo_no_completado": "No debe quedar"},
        )
    real_db.rollback()

    assert _estado(real_db, datos["rescate"]) == RescateEstado.DISPONIBLE
    assert real_db.scalar(select(Rescate.motivo_no_completado).where(Rescate.id == datos["rescate"])) is None
    assert _filas(real_db, datos["rescate"]) == 0


@pytest.mark.parametrize(
    "sentencia",
    [
        "UPDATE historial_estados SET detalle = '{}'::jsonb WHERE rescate_id = :id",
        "DELETE FROM historial_estados WHERE rescate_id = :id",
    ],
)
def test_update_o_delete_sobre_el_historial_falla(real_db, sentencia):
    datos = _escenario(real_db)
    assert cambiar_estado(
        real_db,
        datos["rescate"],
        RescateEstado.DISPONIBLE,
        RescateEstado.NO_COMPLETADO,
        datos["fundacion"],
        cambios={"motivo_no_completado": "Sin voluntarios"},
    )
    real_db.commit()

    with pytest.raises(DBAPIError):
        real_db.execute(text(sentencia), {"id": datos["rescate"]})
    real_db.rollback()
    assert _filas(real_db, datos["rescate"]) == 1
