from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.database import get_db
from app.main import app
from app.models import (
    Comercio,
    IdempotencyKey,
    Rescate,
    RescateHistorial,
    Usuario,
    UsuarioRol,
)
from app.security import create_access_token


class FakeSession:
    def __init__(self, user):
        self.user = user

    def scalar(self, _statement):
        return self.user


def make_user(rol: UsuarioRol):
    return SimpleNamespace(
        id=uuid4(),
        rol=rol,
        activo=True,
        comercio_id=None,
    )


@pytest.fixture
def client():
    user = make_user(UsuarioRol.FUNDACION)
    fake_session = FakeSession(user)
    app.dependency_overrides[get_db] = lambda: fake_session
    with TestClient(app) as test_client:
        yield test_client, user
    app.dependency_overrides.clear()


def auth_header(user):
    token = create_access_token(sub=str(user.id), rol=user.rol.value)
    return {"Authorization": f"Bearer {token}"}


def valid_payload():
    return {
        "comercio_id": str(uuid4()),
        "alimento": "Pan",
        "cantidad_aprox": "20 unidades",
        "lugar_recogida": "Calle 1",
        "hora_limite": "2026-10-28T18:00:00-05:00",
    }


@pytest.mark.parametrize("rol", [UsuarioRol.VOLUNTARIO, UsuarioRol.ORGANIZACION])
def test_roles_no_permitidos_se_rechazan_antes_de_validar_cuerpo(client, rol):
    test_client, user = client
    user.rol = rol
    response = test_client.post(
        "/api/v1/rescates",
        headers=auth_header(user),
        json={},
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "field",
    ["comercio_id", "alimento", "cantidad_aprox", "lugar_recogida", "hora_limite"],
)
def test_campo_obligatorio_devuelve_error_localizado(client, field):
    test_client, user = client
    payload = valid_payload()
    del payload[field]
    response = test_client.post(
        "/api/v1/rescates",
        headers=auth_header(user),
        json=payload,
    )
    assert response.status_code == 422
    assert any(item["campo"] == field and field in item["mensaje"] for item in response.json())


def test_hora_limite_sin_zona_horaria_devuelve_422(client):
    test_client, user = client
    payload = valid_payload()
    payload["hora_limite"] = "2026-10-28T18:00:00"
    response = test_client.post(
        "/api/v1/rescates",
        headers=auth_header(user),
        json=payload,
    )
    assert response.status_code == 422
    assert response.json()[0]["campo"] == "hora_limite"


def test_sin_token_devuelve_401(client):
    test_client, _user = client
    response = test_client.post("/api/v1/rescates", json={})
    assert response.status_code == 401


@pytest.fixture
def integration_client(real_db):
    comercio = Comercio(
        nombre=f"Comercio {uuid4()}",
        direccion="Calle 1",
    )
    usuario = Usuario(
        id=uuid4(),
        nombre="Fundación de prueba",
        email=f"{uuid4()}@example.com",
        password_hash="irrelevante",
        rol=UsuarioRol.FUNDACION,
        activo=True,
    )
    real_db.add_all([comercio, usuario])
    real_db.commit()
    app.dependency_overrides[get_db] = lambda: real_db
    with TestClient(app) as test_client:
        yield test_client, usuario, comercio, real_db
    app.dependency_overrides.clear()


def test_creacion_persiste_rescate_y_historial(integration_client):
    test_client, usuario, comercio, real_db = integration_client
    payload = valid_payload()
    payload["comercio_id"] = str(comercio.id)
    payload["registrado_por"] = str(uuid4())

    response = test_client.post(
        "/api/v1/rescates",
        headers=auth_header(usuario),
        json=payload,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["estado"] == "disponible"
    assert body["id"]
    assert body["creado_en"]
    assert body["registrado_por"] == str(usuario.id)
    assert real_db.scalar(select(func.count()).select_from(Rescate)) == 1
    historial = real_db.scalars(select(RescateHistorial)).all()
    assert len(historial) == 1
    assert historial[0].estado_anterior is None
    assert historial[0].estado_nuevo.value == "disponible"


def test_idempotencia_repite_la_misma_respuesta(integration_client):
    test_client, usuario, comercio, real_db = integration_client
    payload = valid_payload()
    payload["comercio_id"] = str(comercio.id)
    headers = {**auth_header(usuario), "Idempotency-Key": "aviso-1"}

    first = test_client.post("/api/v1/rescates", headers=headers, json=payload)
    second = test_client.post("/api/v1/rescates", headers=headers, json=payload)

    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()
    assert second.headers["idempotent-replay"] == "true"
    assert real_db.scalar(select(func.count()).select_from(Rescate)) == 1


@pytest.mark.parametrize(
    "field",
    ["comercio_id", "alimento", "cantidad_aprox", "lugar_recogida", "hora_limite"],
)
def test_campo_obligatorio_no_inserta_rescate_ni_historial(integration_client, field):
    test_client, usuario, comercio, real_db = integration_client
    payload = valid_payload()
    payload["comercio_id"] = str(comercio.id)
    del payload[field]

    response = test_client.post(
        "/api/v1/rescates",
        headers=auth_header(usuario),
        json=payload,
    )

    assert response.status_code == 422
    assert any(item["campo"] == field for item in response.json())
    assert real_db.scalar(select(func.count()).select_from(Rescate)) == 0
    assert real_db.scalar(select(func.count()).select_from(RescateHistorial)) == 0


def test_idempotencia_misma_clave_con_cuerpo_distinto_devuelve_conflicto(integration_client):
    test_client, usuario, comercio, real_db = integration_client
    payload = valid_payload()
    payload["comercio_id"] = str(comercio.id)
    headers = {**auth_header(usuario), "Idempotency-Key": "aviso-1"}

    first = test_client.post(
        "/api/v1/rescates",
        headers=headers,
        json=payload,
    )
    payload["alimento"] = "Fruta"
    second = test_client.post(
        "/api/v1/rescates",
        headers=headers,
        json=payload,
    )

    assert first.status_code == 201
    assert second.status_code == 409
    assert real_db.scalar(select(func.count()).select_from(Rescate)) == 1
    assert real_db.scalar(select(func.count()).select_from(IdempotencyKey)) == 1


def test_usuario_comercio_sin_comercio_asociado_devuelve_403(real_db):
    comercio = Comercio(
        nombre=f"Comercio {uuid4()}",
        direccion="Calle 1",
    )
    usuario = Usuario(
        id=uuid4(),
        nombre="Comercio sin asociación",
        email=f"{uuid4()}@example.com",
        password_hash="irrelevante",
        rol=UsuarioRol.COMERCIO,
        activo=True,
    )
    real_db.add_all([comercio, usuario])
    real_db.commit()
    app.dependency_overrides[get_db] = lambda: real_db
    try:
        with TestClient(app) as test_client:
            payload = valid_payload()
            payload["comercio_id"] = str(comercio.id)
            response = test_client.post(
                "/api/v1/rescates",
                headers=auth_header(usuario),
                json=payload,
            )
        assert response.status_code == 403
        assert real_db.scalar(select(func.count()).select_from(Rescate)) == 0
    finally:
        app.dependency_overrides.clear()


def test_fundacion_con_comercio_inexistente_devuelve_422_sin_insertar(integration_client):
    test_client, usuario, _comercio, real_db = integration_client
    payload = valid_payload()

    response = test_client.post(
        "/api/v1/rescates",
        headers=auth_header(usuario),
        json=payload,
    )

    assert response.status_code == 422
    assert response.json()[0]["campo"] == "comercio_id"
    assert real_db.scalar(select(func.count()).select_from(Rescate)) == 0
    assert real_db.scalar(select(func.count()).select_from(RescateHistorial)) == 0


def test_fallo_al_insertar_historial_hace_rollback_completo(
    integration_client, monkeypatch
):
    test_client, usuario, comercio, real_db = integration_client
    payload = valid_payload()
    payload["comercio_id"] = str(comercio.id)
    headers = {**auth_header(usuario), "Idempotency-Key": "aviso-rollback"}
    original_add = real_db.add

    def fail_historial(instance, _warn=True):
        if isinstance(instance, RescateHistorial):
            raise RuntimeError("fallo de prueba al insertar historial")
        return original_add(instance, _warn=_warn)

    monkeypatch.setattr(real_db, "add", fail_historial)

    with pytest.raises(RuntimeError, match="fallo de prueba"):
        test_client.post(
            "/api/v1/rescates",
            headers=headers,
            json=payload,
        )

    assert real_db.scalar(select(func.count()).select_from(Rescate)) == 0
    assert real_db.scalar(select(func.count()).select_from(RescateHistorial)) == 0
    assert real_db.scalar(select(func.count()).select_from(IdempotencyKey)) == 0


def test_usuario_comercio_no_puede_usar_otro_comercio(real_db):
    comercio_1 = Comercio(nombre=f"Comercio {uuid4()}", direccion="Calle 1")
    comercio_2 = Comercio(nombre=f"Comercio {uuid4()}", direccion="Calle 2")
    usuario = Usuario(
        id=uuid4(),
        nombre="Comercio de prueba",
        email=f"{uuid4()}@example.com",
        password_hash="irrelevante",
        rol=UsuarioRol.COMERCIO,
        comercio_id=None,
        activo=True,
    )
    real_db.add_all([comercio_1, comercio_2])
    real_db.flush()
    usuario.comercio_id = comercio_1.id
    real_db.add(usuario)
    real_db.commit()
    app.dependency_overrides[get_db] = lambda: real_db
    try:
        with TestClient(app) as test_client:
            payload = valid_payload()
            payload["comercio_id"] = str(comercio_2.id)
            response = test_client.post(
                "/api/v1/rescates",
                headers=auth_header(usuario),
                json=payload,
            )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
