from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app
from app.models import (
    Comercio,
    OrganizacionReceptora,
    Rescate,
    RescateEstado,
    Usuario,
    UsuarioRol,
    Voluntario,
)
from app.security import create_access_token


def _usuario(rol: UsuarioRol, nombre: str, **kwargs) -> Usuario:
    return Usuario(
        id=uuid4(),
        nombre=nombre,
        email=f"{uuid4()}@example.com",
        password_hash="irrelevante",
        rol=rol,
        activo=True,
        **kwargs,
    )


@pytest.fixture
def consulta_data(real_db):
    comercio = Comercio(nombre=f"Comercio consulta {uuid4()}", direccion="Calle 1")
    otro_comercio = Comercio(
        nombre=f"Otro comercio consulta {uuid4()}",
        direccion="Calle 2",
    )
    organizacion = OrganizacionReceptora(
        nombre=f"Organizacion consulta {uuid4()}",
        direccion="Carrera 3",
    )
    otra_organizacion = OrganizacionReceptora(
        nombre=f"Otra organizacion consulta {uuid4()}",
        direccion="Carrera 4",
    )
    real_db.add_all([comercio, otro_comercio, organizacion, otra_organizacion])
    real_db.flush()
    fundacion = _usuario(UsuarioRol.FUNDACION, "Fundacion consulta")
    voluntario = _usuario(UsuarioRol.VOLUNTARIO, "Voluntario consulta")
    otro_voluntario = _usuario(UsuarioRol.VOLUNTARIO, "Otro voluntario consulta")
    usuario_organizacion = _usuario(
        UsuarioRol.ORGANIZACION,
        "Usuario organizacion consulta",
        organizacion_id=organizacion.id,
    )
    usuario_otra_organizacion = _usuario(
        UsuarioRol.ORGANIZACION,
        "Usuario otra organizacion consulta",
        organizacion_id=otra_organizacion.id,
    )
    usuario_comercio = _usuario(
        UsuarioRol.COMERCIO,
        "Usuario comercio consulta",
        comercio_id=comercio.id,
    )
    usuario_otro_comercio = _usuario(
        UsuarioRol.COMERCIO,
        "Usuario otro comercio consulta",
        comercio_id=otro_comercio.id,
    )
    real_db.add_all(
        [
            fundacion,
            voluntario,
            otro_voluntario,
            usuario_organizacion,
            usuario_otra_organizacion,
            usuario_comercio,
            usuario_otro_comercio,
            Voluntario(usuario_id=voluntario.id, disponibilidad="disponible"),
            Voluntario(usuario_id=otro_voluntario.id, disponibilidad="disponible"),
        ]
    )
    real_db.flush()

    def rescate(
        estado: RescateEstado,
        comercio_id=comercio.id,
        organizacion_id=None,
        voluntario_id=None,
        minutos=0,
        registrado_por=fundacion.id,
    ):
        return Rescate(
            comercio_id=comercio_id,
            alimento=f"Alimento {uuid4()}",
            cantidad_aprox="10 kg",
            lugar_recogida="Bodega 1",
            hora_limite=datetime.now(timezone.utc) + timedelta(minutes=minutos),
            observaciones="Solo para pruebas",
            estado=estado,
            registrado_por=registrado_por,
            organizacion_id=organizacion_id,
            voluntario_id=voluntario_id,
            asignado_en=datetime.now(timezone.utc)
            if estado in {RescateEstado.ASIGNADO, RescateEstado.RECOGIDO}
            else None,
            asignado_por=fundacion.id
            if estado in {RescateEstado.ASIGNADO, RescateEstado.RECOGIDO}
            else None,
            motivo_no_completado="Prueba"
            if estado == RescateEstado.NO_COMPLETADO
            else None,
        )

    disponible = rescate(RescateEstado.DISPONIBLE, minutos=1)
    asignado = rescate(
        RescateEstado.ASIGNADO,
        organizacion_id=organizacion.id,
        voluntario_id=voluntario.id,
        minutos=2,
    )
    recogido = rescate(
        RescateEstado.RECOGIDO,
        organizacion_id=organizacion.id,
        voluntario_id=voluntario.id,
        minutos=3,
    )
    entregado = rescate(
        RescateEstado.ENTREGADO,
        organizacion_id=organizacion.id,
        voluntario_id=voluntario.id,
        minutos=4,
    )
    entregado.recibido_por = fundacion.id
    entregado.cantidad_recibida = 10
    no_completado = rescate(RescateEstado.NO_COMPLETADO, minutos=5)
    creado_por_comercio = rescate(
        RescateEstado.DISPONIBLE,
        comercio_id=comercio.id,
        minutos=6,
        registrado_por=usuario_comercio.id,
    )
    asignado_otro_voluntario = rescate(
        RescateEstado.ASIGNADO,
        organizacion_id=otra_organizacion.id,
        voluntario_id=otro_voluntario.id,
        minutos=7,
    )
    real_db.add_all(
        [
            disponible,
            asignado,
            recogido,
            entregado,
            no_completado,
            creado_por_comercio,
            asignado_otro_voluntario,
        ]
    )
    real_db.commit()
    return SimpleNamespace(
        db=real_db,
        fundacion=fundacion,
        voluntario=voluntario,
        otro_voluntario=otro_voluntario,
        usuario_organizacion=usuario_organizacion,
        usuario_otra_organizacion=usuario_otra_organizacion,
        usuario_comercio=usuario_comercio,
        usuario_otro_comercio=usuario_otro_comercio,
        comercio=comercio,
        organizacion=organizacion,
        disponible=disponible,
        creado_por_comercio=creado_por_comercio,
        asignado=asignado,
        asignado_otro_voluntario=asignado_otro_voluntario,
        recogido=recogido,
        activo_ids={disponible.id, asignado.id, recogido.id},
        inactivo_ids={entregado.id, no_completado.id},
    )


def _headers(usuario: Usuario) -> dict[str, str]:
    token = create_access_token(sub=str(usuario.id), rol=usuario.rol.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def api_client(consulta_data):
    app.dependency_overrides[get_db] = lambda: consulta_data.db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def test_listado_activos_ordenado_y_con_pendiente(api_client, consulta_data):
    response = api_client.get(
        "/api/v1/rescates?estado=activos",
        headers=_headers(consulta_data.fundacion),
    )

    assert response.status_code == 200
    body = response.json()
    selected = [item for item in body if item["id"] in {str(i) for i in consulta_data.activo_ids}]
    assert {item["id"] for item in selected} == {
        str(item_id) for item_id in consulta_data.activo_ids
    }
    assert not {item["id"] for item in body} & {
        str(item_id) for item_id in consulta_data.inactivo_ids
    }
    assert selected[0]["hora_limite"] <= selected[1]["hora_limite"] <= selected[2]["hora_limite"]
    disponible = next(item for item in selected if item["estado"] == "disponible")
    asignados = [item for item in selected if item["estado"] != "disponible"]
    assert disponible["pendiente_asignar"] is True
    assert disponible["origen_aviso"] == "fundacion"
    aviso_comercio = next(
        item for item in body if item["id"] == str(consulta_data.creado_por_comercio.id)
    )
    assert aviso_comercio["origen_aviso"] == "comercio"
    assert all(item["pendiente_asignar"] is False for item in asignados)


def test_listado_no_marca_rescate_vencido_como_pendiente(api_client, consulta_data):
    rescate = consulta_data.db.get(Rescate, consulta_data.disponible.id)
    rescate.hora_limite = datetime.now(timezone.utc) - timedelta(minutes=1)
    consulta_data.db.commit()

    response = api_client.get(
        "/api/v1/rescates?estado=activos",
        headers=_headers(consulta_data.fundacion),
    )

    assert response.status_code == 200
    item = next(row for row in response.json() if row["id"] == str(rescate.id))
    assert item["estado"] == "disponible"
    assert item["pendiente_asignar"] is False


@pytest.mark.parametrize("query", ["/api/v1/rescates", "/api/v1/rescates?estado=invalid"])
def test_listado_requiere_estado_activos(api_client, consulta_data, query):
    response = api_client.get(query, headers=_headers(consulta_data.fundacion))
    assert response.status_code == 422
    assert "activos" in response.json()["detail"]


@pytest.mark.parametrize(
    ("usuario", "atributo"),
    [
        ("voluntario", "voluntario"),
        ("organizacion", "usuario_organizacion"),
        ("comercio", "usuario_comercio"),
    ],
)
def test_listado_solo_fundacion(api_client, consulta_data, usuario, atributo):
    response = api_client.get(
        "/api/v1/rescates?estado=activos",
        headers=_headers(getattr(consulta_data, atributo)),
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "usuario",
    [
        "voluntario",
        "usuario_organizacion",
    ],
)
def test_listado_mis_asignaciones_filtra_por_usuario_y_organizacion(
    api_client, consulta_data, usuario
):
    response = api_client.get(
        "/api/v1/rescates/mis-asignaciones",
        headers=_headers(getattr(consulta_data, usuario)),
    )

    assert response.status_code == 200
    body = response.json()
    expected_ids = {
        consulta_data.asignado.id,
        consulta_data.recogido.id,
        consulta_data.entregado.id,
    }
    assert {item["id"] for item in body} == {str(item_id) for item_id in expected_ids}
    assert all(item["estado"] in {"asignado", "recogido", "entregado"} for item in body)
    assert all(item["pendiente_asignar"] is False for item in body)
    assert all(item["fundacion"] == consulta_data.fundacion.nombre for item in body)
    assert all(item["lugar_recogida"] == "Bodega 1" for item in body)
    assert all(item["lugar_entrega"] == "Carrera 3" for item in body)
    assert next(item for item in body if item["id"] == str(consulta_data.asignado.id))[
        "estado_visual"
    ] == "por_recibir"
    assert next(item for item in body if item["id"] == str(consulta_data.recogido.id))[
        "estado_visual"
    ] == ("entregado_por_voluntario" if usuario == "voluntario" else "por_recibir")
    assert str(consulta_data.asignado_otro_voluntario.id) not in {
        item["id"] for item in body
    }


@pytest.mark.parametrize(
    "usuario",
    ["fundacion", "usuario_comercio"],
)
def test_listado_mis_asignaciones_restringido_a_voluntario_y_organizacion(
    api_client, consulta_data, usuario
):
    response = api_client.get(
        "/api/v1/rescates/mis-asignaciones",
        headers=_headers(getattr(consulta_data, usuario)),
    )
    assert response.status_code == 403


def test_voluntario_entrega_y_organizacion_confirma_recepcion(api_client, consulta_data):
    entrega = api_client.post(
        f"/api/v1/rescates/{consulta_data.asignado.id}/entrega-voluntario",
        headers=_headers(consulta_data.voluntario),
    )
    assert entrega.status_code == 204
    consulta_data.db.refresh(consulta_data.asignado)
    assert consulta_data.asignado.estado == RescateEstado.RECOGIDO
    assert consulta_data.asignado.recogido_en is not None

    recepcion = api_client.post(
        f"/api/v1/rescates/{consulta_data.asignado.id}/recepcion",
        headers=_headers(consulta_data.usuario_organizacion),
        json={
            "cantidad_recibida": 8.5,
            "unidad_recibida": "kg",
            "es_medida": True,
            "personas_beneficiadas": 12,
        },
    )
    assert recepcion.status_code == 204
    consulta_data.db.refresh(consulta_data.asignado)
    assert consulta_data.asignado.estado == RescateEstado.ENTREGADO
    assert consulta_data.asignado.recibido_por == consulta_data.usuario_organizacion.id
    assert float(consulta_data.asignado.cantidad_recibida) == 8.5
    assert consulta_data.asignado.unidad_recibida == "kg"
    assert consulta_data.asignado.es_medida is True
    assert consulta_data.asignado.personas_beneficiadas == 12


def test_organizacion_no_confirma_antes_de_entrega_voluntario(api_client, consulta_data):
    response = api_client.post(
        f"/api/v1/rescates/{consulta_data.asignado.id}/recepcion",
        headers=_headers(consulta_data.usuario_organizacion),
        json={
            "cantidad_recibida": 8.5,
            "unidad_recibida": "kg",
            "es_medida": True,
        },
    )
    assert response.status_code == 409
    consulta_data.db.refresh(consulta_data.asignado)
    assert consulta_data.asignado.estado == RescateEstado.ASIGNADO


def test_voluntario_ajeno_no_puede_marcar_entrega(api_client, consulta_data):
    response = api_client.post(
        f"/api/v1/rescates/{consulta_data.asignado.id}/entrega-voluntario",
        headers=_headers(consulta_data.otro_voluntario),
    )
    assert response.status_code == 404


def test_detalle_fundacion_ve_detalle_completo(api_client, consulta_data):
    response = api_client.get(
        f"/api/v1/rescates/{consulta_data.asignado.id}",
        headers=_headers(consulta_data.fundacion),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["alimento"]
    assert body["lugar_recogida"] == "Bodega 1"
    assert body["lugar_entrega"] == "Carrera 3"
    assert body["asignado_por"] == str(consulta_data.fundacion.id)


def test_detalle_voluntario_asignado_ve_los_cuatro_datos(
    api_client, consulta_data
):
    response = api_client.get(
        f"/api/v1/rescates/{consulta_data.asignado.id}",
        headers=_headers(consulta_data.voluntario),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["hora_limite"]
    assert body["cantidad_aprox"] == "10 kg"
    assert body["lugar_recogida"] == "Bodega 1"
    assert body["lugar_entrega"] == "Carrera 3"
    assert "alimento" not in body
    assert "observaciones" not in body


def test_detalle_voluntario_no_asignado_es_404(api_client, consulta_data):
    response = api_client.get(
        f"/api/v1/rescates/{consulta_data.asignado.id}",
        headers=_headers(consulta_data.otro_voluntario),
    )
    assert response.status_code == 404


def test_detalle_autoriza_organizacion_y_comercio_propietarios(
    api_client, consulta_data
):
    organizacion = api_client.get(
        f"/api/v1/rescates/{consulta_data.asignado.id}",
        headers=_headers(consulta_data.usuario_organizacion),
    )
    comercio = api_client.get(
        f"/api/v1/rescates/{consulta_data.asignado.id}",
        headers=_headers(consulta_data.usuario_comercio),
    )
    assert organizacion.status_code == comercio.status_code == 200
    assert organizacion.json()["comercio"] == consulta_data.comercio.nombre
    assert organizacion.json()["fundacion"] == consulta_data.fundacion.nombre
    assert organizacion.json()["voluntario"] == consulta_data.voluntario.nombre
    assert organizacion.json()["estado_visual"] == "por_recibir"
    assert comercio.json()["comercio"] == consulta_data.comercio.nombre
    assert "lugar_recogida" not in organizacion.json()
    assert "cantidad_aprox" not in comercio.json()


@pytest.mark.parametrize("usuario", ["usuario_otra_organizacion", "usuario_otro_comercio"])
def test_detalle_rechaza_organizacion_y_comercio_ajenos(
    api_client, consulta_data, usuario
):
    response = api_client.get(
        f"/api/v1/rescates/{consulta_data.asignado.id}",
        headers=_headers(getattr(consulta_data, usuario)),
    )
    assert response.status_code == 404


def test_detalle_inexistente_es_404(api_client, consulta_data):
    response = api_client.get(
        f"/api/v1/rescates/{uuid4()}",
        headers=_headers(consulta_data.fundacion),
    )
    assert response.status_code == 404


def test_detalle_sin_token_es_401(api_client, consulta_data):
    response = api_client.get(f"/api/v1/rescates/{consulta_data.asignado.id}")
    assert response.status_code == 401
