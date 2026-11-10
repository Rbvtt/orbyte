from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

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


@pytest.fixture(params=[RescateEstado.DISPONIBLE, RescateEstado.ASIGNADO])
def cierre_data(real_db, request):
    estado = request.param
    comercio = Comercio(nombre=f"Comercio {uuid4()}", direccion="Calle 1")
    organizacion = OrganizacionReceptora(nombre=f"Organizacion {uuid4()}", direccion="Carrera 2")
    fundacion = _usuario(UsuarioRol.FUNDACION, "Fundacion")
    voluntario = _usuario(UsuarioRol.VOLUNTARIO, "Voluntario")
    real_db.add_all([comercio, organizacion, fundacion, voluntario])
    real_db.flush()
    real_db.add(Voluntario(usuario_id=voluntario.id, disponibilidad="disponible"))
    real_db.flush()
    rescate = Rescate(
        comercio_id=comercio.id,
        alimento="Pan",
        cantidad_aprox="20 unidades",
        lugar_recogida="Calle 1",
        hora_limite=datetime(2026, 11, 20, 20, 0, tzinfo=timezone.utc),
        registrado_por=fundacion.id,
        estado=estado,
        organizacion_id=organizacion.id if estado != RescateEstado.DISPONIBLE else None,
        voluntario_id=voluntario.id if estado != RescateEstado.DISPONIBLE else None,
        asignado_en=datetime.now(timezone.utc) if estado != RescateEstado.DISPONIBLE else None,
        asignado_por=fundacion.id if estado != RescateEstado.DISPONIBLE else None,
        recogido_en=datetime.now(timezone.utc) if estado == RescateEstado.RECOGIDO else None,
        entregado_en=datetime.now(timezone.utc) if estado == RescateEstado.ENTREGADO else None,
        recibido_por=fundacion.id if estado == RescateEstado.ENTREGADO else None,
        cantidad_recibida=10 if estado == RescateEstado.ENTREGADO else None,
        unidad_recibida="kg" if estado == RescateEstado.ENTREGADO else None,
        es_medida=True if estado == RescateEstado.ENTREGADO else None,
    )
    real_db.add(rescate)
    real_db.commit()
    return SimpleNamespace(
        db=real_db,
        fundacion=fundacion,
        voluntario=voluntario,
        organizacion=organizacion,
        rescate=rescate,
        estado=estado,
    )


@pytest.fixture
def api_client(cierre_data):
    app.dependency_overrides[get_db] = lambda: cierre_data.db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def _headers(usuario: Usuario) -> dict[str, str]:
    token = create_access_token(sub=str(usuario.id), rol=usuario.rol.value)
    return {"Authorization": f"Bearer {token}"}


def test_cierra_rescate_activo_y_guarda_motivo_en_rescate_e_historial(api_client, cierre_data):
    motivo = "El comercio cerró antes de la hora acordada."
    response = api_client.post(
        f"/api/v1/rescates/{cierre_data.rescate.id}/no-completado",
        json={"motivo": f"  {motivo}  "},
        headers=_headers(cierre_data.fundacion),
    )

    assert response.status_code == 200
    cuerpo = response.json()
    assert cuerpo["id"] == str(cierre_data.rescate.id)
    assert cuerpo["estado"] == "no_completado"
    assert cuerpo["motivo_no_completado"] == motivo
    cierre_data.db.expire_all()
    rescate = cierre_data.db.get(Rescate, cierre_data.rescate.id)
    historial = cierre_data.db.scalars(
        select(RescateHistorial).where(RescateHistorial.rescate_id == rescate.id)
    ).all()
    assert rescate.estado == RescateEstado.NO_COMPLETADO
    assert rescate.motivo_no_completado == motivo
    assert len(historial) == 1
    assert historial[0].estado_anterior == cierre_data.estado
    assert historial[0].estado_nuevo == RescateEstado.NO_COMPLETADO
    assert historial[0].cambiado_por == cierre_data.fundacion.id
    assert historial[0].detalle["motivo"] == motivo

    detalle_fundacion = api_client.get(
        f"/api/v1/rescates/{rescate.id}", headers=_headers(cierre_data.fundacion)
    )
    detalle_voluntario = api_client.get(
        f"/api/v1/rescates/{rescate.id}", headers=_headers(cierre_data.voluntario)
    )
    assert detalle_fundacion.json()["motivo_no_completado"] == motivo
    assert "motivo_no_completado" not in detalle_voluntario.json()


@pytest.mark.parametrize("estado", [RescateEstado.RECOGIDO, RescateEstado.ENTREGADO])
def test_estados_recogido_y_entregado_no_se_pueden_cerrar(api_client, cierre_data, estado):
    rescate = cierre_data.rescate
    cierre_data.db.execute(
        text(
            """
            UPDATE rescates SET
                estado = CAST(:estado AS rescate_estado),
                organizacion_id = :organizacion_id,
                voluntario_id = :voluntario_id,
                asignado_en = now(),
                asignado_por = :fundacion_id,
                recogido_en = now(),
                entregado_en = :entregado_en,
                recibido_por = :recibido_por,
                cantidad_recibida = :cantidad_recibida,
                unidad_recibida = :unidad_recibida,
                es_medida = :es_medida
            WHERE id = :rescate_id
            """
        ),
        {
            "estado": estado.value,
            "organizacion_id": cierre_data.organizacion.id,
            "voluntario_id": cierre_data.voluntario.id,
            "fundacion_id": cierre_data.fundacion.id,
            "entregado_en": datetime.now(timezone.utc)
            if estado == RescateEstado.ENTREGADO
            else None,
            "recibido_por": cierre_data.fundacion.id
            if estado == RescateEstado.ENTREGADO
            else None,
            "cantidad_recibida": 10 if estado == RescateEstado.ENTREGADO else None,
            "unidad_recibida": "kg" if estado == RescateEstado.ENTREGADO else None,
            "es_medida": True if estado == RescateEstado.ENTREGADO else None,
            "rescate_id": rescate.id,
        },
    )
    cierre_data.db.commit()

    response = api_client.post(
        f"/api/v1/rescates/{rescate.id}/no-completado",
        json={"motivo": "Ya fue recogido"},
        headers=_headers(cierre_data.fundacion),
    )

    assert response.status_code == 409
    cierre_data.db.refresh(rescate)
    assert rescate.estado == estado
    assert rescate.motivo_no_completado is None
    assert cierre_data.db.scalar(
        select(RescateHistorial.id).where(RescateHistorial.rescate_id == rescate.id)
    ) is None


def test_motivo_vacio_devuelve_422(api_client, cierre_data):
    response = api_client.post(
        f"/api/v1/rescates/{cierre_data.rescate.id}/no-completado",
        json={"motivo": "   "},
        headers=_headers(cierre_data.fundacion),
    )
    assert response.status_code == 422


def test_solo_fundacion_puede_cerrar_no_completado(api_client, cierre_data):
    response = api_client.post(
        f"/api/v1/rescates/{cierre_data.rescate.id}/no-completado",
        json={"motivo": "No se pudo coordinar"},
        headers=_headers(cierre_data.voluntario),
    )
    assert response.status_code == 403


def test_rescate_inexistente_devuelve_404(api_client, cierre_data):
    response = api_client.post(
        f"/api/v1/rescates/{uuid4()}/no-completado",
        json={"motivo": "No existe"},
        headers=_headers(cierre_data.fundacion),
    )
    assert response.status_code == 404
