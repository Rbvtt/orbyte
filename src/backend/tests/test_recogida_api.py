"""#16 · POST /api/v1/rescates/{id}/recogida — transición asignado → recogido (CA-04.1, RF-012, RF-014).

Criterios técnicos:
- Voluntario asignado → 200, estado recogido, voluntario, fecha y hora registrados.
- Otro voluntario → 403. Estado distinto de asignado → 409.
- Historial asignado → recogido en la misma transacción.
"""

import pytest
from sqlalchemy import select

from app.models import RescateEstado, RescateHistorial
from tests.test_consulta_rescates import _headers, api_client, consulta_data  # noqa: F401


def _historial(datos, rescate):
    return datos.db.scalars(
        select(RescateHistorial)
        .where(RescateHistorial.rescate_id == rescate.id)
        .order_by(RescateHistorial.id)
    ).all()


def _recogida(api_client, rescate, usuario):  # noqa: F811
    return api_client.post(f"/api/v1/rescates/{rescate.id}/recogida", headers=_headers(usuario))


def test_voluntario_asignado_registra_la_recogida(api_client, consulta_data):  # noqa: F811
    respuesta = _recogida(api_client, consulta_data.asignado, consulta_data.voluntario)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["id"] == str(consulta_data.asignado.id)
    assert cuerpo["estado"] == "recogido"
    assert cuerpo["voluntario_id"] == str(consulta_data.voluntario.id)
    assert cuerpo["voluntario"] == consulta_data.voluntario.nombre
    assert cuerpo["recogido_en"]

    consulta_data.db.refresh(consulta_data.asignado)
    assert consulta_data.asignado.estado == RescateEstado.RECOGIDO
    assert consulta_data.asignado.recogido_en is not None

    (fila,) = _historial(consulta_data, consulta_data.asignado)
    assert (fila.estado_anterior, fila.estado_nuevo) == (RescateEstado.ASIGNADO, RescateEstado.RECOGIDO)
    assert fila.cambiado_por == consulta_data.voluntario.id
    assert fila.detalle == {"accion": "recogida_registrada"}


def test_otro_voluntario_recibe_403_y_no_cambia_nada(api_client, consulta_data):  # noqa: F811
    respuesta = _recogida(api_client, consulta_data.asignado, consulta_data.otro_voluntario)

    assert respuesta.status_code == 403
    consulta_data.db.refresh(consulta_data.asignado)
    assert consulta_data.asignado.estado == RescateEstado.ASIGNADO
    assert consulta_data.asignado.recogido_en is None
    assert _historial(consulta_data, consulta_data.asignado) == []


@pytest.mark.parametrize("estado", ["recogido", "entregado"])
def test_estado_distinto_de_asignado_devuelve_409(api_client, consulta_data, estado):  # noqa: F811
    rescate = getattr(consulta_data, estado)

    respuesta = _recogida(api_client, rescate, consulta_data.voluntario)

    assert respuesta.status_code == 409
    consulta_data.db.refresh(rescate)
    assert rescate.estado == RescateEstado(estado)
    assert _historial(consulta_data, rescate) == []


def test_registrar_dos_veces_la_recogida_devuelve_409(api_client, consulta_data):  # noqa: F811
    assert _recogida(api_client, consulta_data.asignado, consulta_data.voluntario).status_code == 200

    assert _recogida(api_client, consulta_data.asignado, consulta_data.voluntario).status_code == 409
    assert len(_historial(consulta_data, consulta_data.asignado)) == 1


@pytest.mark.parametrize("usuario", ["fundacion", "usuario_organizacion", "usuario_comercio"])
def test_solo_el_rol_voluntario_registra_la_recogida(api_client, consulta_data, usuario):  # noqa: F811
    respuesta = _recogida(api_client, consulta_data.asignado, getattr(consulta_data, usuario))

    assert respuesta.status_code == 403
    consulta_data.db.refresh(consulta_data.asignado)
    assert consulta_data.asignado.estado == RescateEstado.ASIGNADO


def test_rescate_inexistente_devuelve_404(api_client, consulta_data):  # noqa: F811
    respuesta = api_client.post(
        "/api/v1/rescates/00000000-0000-0000-0000-000000000000/recogida",
        headers=_headers(consulta_data.voluntario),
    )
    assert respuesta.status_code == 404


def test_flujo_recogida_entrega_del_voluntario_y_recepcion(api_client, consulta_data):  # noqa: F811
    """La recogida (#16) convive con la entrega del voluntario y la recepción de la organización."""
    rescate = consulta_data.asignado
    voluntario = _headers(consulta_data.voluntario)
    assert _recogida(api_client, rescate, consulta_data.voluntario).status_code == 200

    # Recién recogido: el voluntario lo ve como «recogido» y puede marcar la entrega.
    detalle = api_client.get(f"/api/v1/rescates/{rescate.id}", headers=voluntario).json()
    assert detalle["estado_visual"] == "recogido"
    assert detalle["voluntario_id"] == str(consulta_data.voluntario.id)
    lista = api_client.get("/api/v1/rescates/mis-asignaciones", headers=voluntario).json()
    assert next(item for item in lista if item["id"] == str(rescate.id))["estado_visual"] == "recogido"

    entrega = api_client.post(f"/api/v1/rescates/{rescate.id}/entrega-voluntario", headers=voluntario)
    assert entrega.status_code == 204
    consulta_data.db.refresh(rescate)
    assert rescate.estado == RescateEstado.RECOGIDO
    detalle = api_client.get(f"/api/v1/rescates/{rescate.id}", headers=voluntario).json()
    assert detalle["estado_visual"] == "entregado_por_voluntario"
    repetida = api_client.post(f"/api/v1/rescates/{rescate.id}/entrega-voluntario", headers=voluntario)
    assert repetida.status_code == 409

    recepcion = api_client.post(
        f"/api/v1/rescates/{rescate.id}/recepcion",
        headers=_headers(consulta_data.usuario_organizacion),
        json={"cantidad_recibida": 9, "unidad_recibida": "kg", "es_medida": True},
    )
    assert recepcion.status_code == 204
    consulta_data.db.refresh(rescate)
    assert rescate.estado == RescateEstado.ENTREGADO
    assert [(f.estado_anterior, f.estado_nuevo) for f in _historial(consulta_data, rescate)] == [
        (RescateEstado.ASIGNADO, RescateEstado.RECOGIDO),
        (RescateEstado.RECOGIDO, RescateEstado.RECOGIDO),
        (RescateEstado.RECOGIDO, RescateEstado.ENTREGADO),
    ]
