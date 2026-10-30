from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import get_db
from app.main import app
from app.models import (
    Comercio,
    OrganizacionReceptora,
    Rescate,
    RescateEstado,
    RescateHistorial,
    Usuario,
    UsuarioRol,
    Voluntario,
)
from app.security import create_access_token


def _usuario(rol: UsuarioRol, nombre: str) -> Usuario:
    return Usuario(
        id=uuid4(),
        nombre=nombre,
        email=f"{uuid4()}@example.com",
        password_hash="irrelevante",
        rol=rol,
        activo=True,
    )


@pytest.fixture
def asignacion_data(real_db):
    comercio = Comercio(nombre=f"Comercio {uuid4()}", direccion="Calle 1")
    organizacion = OrganizacionReceptora(
        nombre=f"Organizacion {uuid4()}",
        direccion="Calle 2",
        capacidad_kg=100,
        refrigeracion=True,
        horario_recepcion="08:00-17:00",
    )
    fundacion = _usuario(UsuarioRol.FUNDACION, "Fundacion de prueba")
    voluntario = _usuario(UsuarioRol.VOLUNTARIO, "Voluntario ganador")
    otro_voluntario = _usuario(UsuarioRol.VOLUNTARIO, "Voluntario alterno")
    roles = [
        _usuario(UsuarioRol.VOLUNTARIO, "Rol voluntario"),
        _usuario(UsuarioRol.ORGANIZACION, "Rol organizacion"),
        _usuario(UsuarioRol.COMERCIO, "Rol comercio"),
    ]
    real_db.add_all(
        [
            comercio,
            organizacion,
            fundacion,
            voluntario,
            otro_voluntario,
            *roles,
            Voluntario(usuario_id=voluntario.id, disponibilidad="disponible"),
            Voluntario(usuario_id=otro_voluntario.id, disponibilidad="disponible"),
        ]
    )
    real_db.flush()
    rescate = Rescate(
        comercio_id=comercio.id,
        alimento="Pan",
        cantidad_aprox="20 unidades",
        lugar_recogida="Calle 1",
        hora_limite=datetime(2026, 10, 28, 23, 0, tzinfo=timezone.utc),
        registrado_por=fundacion.id,
        estado=RescateEstado.DISPONIBLE,
    )
    real_db.add(rescate)
    real_db.commit()
    return SimpleNamespace(
        db=real_db,
        fundacion=fundacion,
        organizacion=organizacion,
        voluntario=voluntario,
        otro_voluntario=otro_voluntario,
        roles=roles,
        rescate=rescate,
    )


def _headers(usuario: Usuario) -> dict[str, str]:
    token = create_access_token(sub=str(usuario.id), rol=usuario.rol.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def api_client(asignacion_data):
    app.dependency_overrides[get_db] = lambda: asignacion_data.db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def _payload(data):
    return {
        "organizacion_id": str(data.organizacion.id),
        "voluntario_id": str(data.voluntario.id),
    }


def test_patch_asigna_y_registra_historial(api_client, asignacion_data):
    response = api_client.patch(
        f"/api/v1/rescates/{asignacion_data.rescate.id}/asignacion",
        headers=_headers(asignacion_data.fundacion),
        json=_payload(asignacion_data),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["estado"] == "asignado"
    assert body["organizacion_id"] == str(asignacion_data.organizacion.id)
    assert body["voluntario_id"] == str(asignacion_data.voluntario.id)
    assert body["asignado_en"]
    assert body["asignado_por"] == str(asignacion_data.fundacion.id)

    asignacion_data.db.expire_all()
    rescate = asignacion_data.db.get(Rescate, asignacion_data.rescate.id)
    historial = asignacion_data.db.scalars(
        select(RescateHistorial).where(
            RescateHistorial.rescate_id == asignacion_data.rescate.id
        )
    ).all()
    assert rescate.estado == RescateEstado.ASIGNADO
    assert len(historial) == 1
    assert historial[0].estado_anterior == RescateEstado.DISPONIBLE
    assert historial[0].estado_nuevo == RescateEstado.ASIGNADO
    assert historial[0].cambiado_por == asignacion_data.fundacion.id


def test_patch_en_conflicto_devuelve_nombre_y_no_cambia_fila(
    api_client, asignacion_data
):
    url = f"/api/v1/rescates/{asignacion_data.rescate.id}/asignacion"
    first = api_client.patch(
        url,
        headers=_headers(asignacion_data.fundacion),
        json=_payload(asignacion_data),
    )
    before = asignacion_data.db.get(Rescate, asignacion_data.rescate.id)
    before_assigned_at = before.asignado_en

    second = api_client.patch(
        url,
        headers=_headers(asignacion_data.fundacion),
        json={
            "organizacion_id": str(asignacion_data.organizacion.id),
            "voluntario_id": str(asignacion_data.otro_voluntario.id),
        },
    )

    assert first.status_code == 200
    assert second.status_code == 409
    assert asignacion_data.voluntario.nombre in second.json()["detail"]
    asignacion_data.db.expire_all()
    after = asignacion_data.db.get(Rescate, asignacion_data.rescate.id)
    assert after.voluntario_id == asignacion_data.voluntario.id
    assert after.asignado_en == before_assigned_at


@pytest.mark.parametrize(
    ("path_id", "payload", "message"),
    [
        (uuid4(), lambda data: _payload(data), "rescate"),
        (None, lambda data: {"organizacion_id": str(uuid4()), "voluntario_id": str(data.voluntario.id)}, "organización"),
        (None, lambda data: {"organizacion_id": str(data.organizacion.id), "voluntario_id": str(uuid4())}, "voluntario"),
    ],
)
def test_patch_devuelve_404_para_recursos_inexistentes(
    api_client, asignacion_data, path_id, payload, message
):
    response = api_client.patch(
        f"/api/v1/rescates/{path_id or asignacion_data.rescate.id}/asignacion",
        headers=_headers(asignacion_data.fundacion),
        json=payload(asignacion_data),
    )

    assert response.status_code == 404
    assert message in response.json()["detail"]


@pytest.mark.parametrize("rol_index", [0, 1, 2])
def test_patch_rechaza_roles_no_fundacion(api_client, asignacion_data, rol_index):
    response = api_client.patch(
        f"/api/v1/rescates/{asignacion_data.rescate.id}/asignacion",
        headers=_headers(asignacion_data.roles[rol_index]),
        json=_payload(asignacion_data),
    )

    assert response.status_code == 403


def test_patch_sin_token_devuelve_401(api_client, asignacion_data):
    response = api_client.patch(
        f"/api/v1/rescates/{asignacion_data.rescate.id}/asignacion",
        json=_payload(asignacion_data),
    )

    assert response.status_code == 401


def test_patch_body_invalido_devuelve_422(api_client, asignacion_data):
    response = api_client.patch(
        f"/api/v1/rescates/{asignacion_data.rescate.id}/asignacion",
        headers=_headers(asignacion_data.fundacion),
        json={},
    )

    assert response.status_code == 422
    assert {item["campo"] for item in response.json()} == {
        "organizacion_id",
        "voluntario_id",
    }


def test_patch_hace_rollback_si_falla_historial(api_client, asignacion_data, monkeypatch):
    original_add = asignacion_data.db.add

    def fail_historial(instance, _warn=True):
        if isinstance(instance, RescateHistorial):
            raise RuntimeError("fallo de prueba al insertar historial")
        return original_add(instance, _warn=_warn)

    monkeypatch.setattr(asignacion_data.db, "add", fail_historial)

    with pytest.raises(RuntimeError, match="fallo de prueba"):
        api_client.patch(
            f"/api/v1/rescates/{asignacion_data.rescate.id}/asignacion",
            headers=_headers(asignacion_data.fundacion),
            json=_payload(asignacion_data),
        )

    asignacion_data.db.expire_all()
    rescate = asignacion_data.db.get(Rescate, asignacion_data.rescate.id)
    assert rescate.estado == RescateEstado.DISPONIBLE
    assert rescate.voluntario_id is None
    assert asignacion_data.db.scalars(
        select(RescateHistorial).where(
            RescateHistorial.rescate_id == asignacion_data.rescate.id
        )
    ).all() == []


def test_get_catalogos_solo_expone_datos_operativos(api_client, asignacion_data):
    organizaciones = api_client.get(
        "/api/v1/organizaciones",
        headers=_headers(asignacion_data.fundacion),
    )
    voluntarios = api_client.get(
        "/api/v1/voluntarios",
        headers=_headers(asignacion_data.fundacion),
    )

    assert organizaciones.status_code == voluntarios.status_code == 200
    organizacion_body = next(
        item
        for item in organizaciones.json()
        if item["id"] == str(asignacion_data.organizacion.id)
    )
    assert organizacion_body == {
        "id": str(asignacion_data.organizacion.id),
        "nombre": asignacion_data.organizacion.nombre,
        "capacidad_kg": 100.0,
        "refrigeracion": True,
        "horario_recepcion": "08:00-17:00",
    }
    volunteer_body = next(
        item
        for item in voluntarios.json()
        if item["id"] == str(asignacion_data.voluntario.id)
    )
    assert volunteer_body["nombre"] == asignacion_data.voluntario.nombre
    assert "email" not in volunteer_body
    assert "password_hash" not in volunteer_body


@pytest.mark.parametrize("path", ["/api/v1/organizaciones", "/api/v1/voluntarios"])
def test_get_catalogos_rechaza_roles_no_fundacion(api_client, asignacion_data, path):
    response = api_client.get(
        path,
        headers=_headers(asignacion_data.roles[0]),
    )

    assert response.status_code == 403
