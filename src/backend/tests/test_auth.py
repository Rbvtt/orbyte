from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from fastapi import Depends, HTTPException
from fastapi.testclient import TestClient

from app.database import get_db
from app.deps import require_role
from app.main import app
from app.models import Comercio, UsuarioEstado, UsuarioRol
from app.routers.auth import _validate_admin_managed_account, _validate_comercio, _validate_pending_approval
from app.security import ALGORITHM, create_access_token, decode_token, hash_password


class FakeSession:
    def __init__(self, user=None, target_user=None):
        self.user = user
        self.target_user = target_user
        self.added = []
        self.commits = 0

    def scalar(self, _statement):
        return self.user

    def add(self, instance):
        self.added.append(instance)

    def flush(self):
        for instance in self.added:
            if isinstance(instance, Comercio) and instance.id is None:
                instance.id = uuid4()

    def get(self, _model, identifier):
        if self.target_user is not None and self.target_user.id == identifier:
            return self.target_user
        return self.user

    def commit(self):
        self.commits += 1


def make_user(
    *,
    email="user@example.com",
    password="correct-password",
    rol=UsuarioRol.FUNDACION,
    activo=True,
):
    return SimpleNamespace(
        id=uuid4(),
        nombre="Usuario de prueba",
        email=email,
        password_hash=hash_password(password),
        rol=rol,
        comercio_id=None,
        activo=activo,
    )


@pytest.fixture
def client():
    fake_session = FakeSession()
    app.dependency_overrides[get_db] = lambda: fake_session
    with TestClient(app) as test_client:
        yield test_client, fake_session
    app.dependency_overrides.clear()


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


@app.get("/_solo_fundacion")
def solo_fundacion(current_user=Depends(require_role("fundacion"))):
    return current_user


@app.get("/_varios")
def varios(current_user=Depends(require_role("comercio", "fundacion"))):
    return current_user


def test_login_correcto_devuelve_token(client):
    test_client, fake_session = client
    user = make_user()
    fake_session.user = user

    response = test_client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "correct-password"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    payload = decode_token(body["access_token"])
    assert payload["sub"] == str(user.id)
    assert payload["rol"] == "fundacion"
    assert isinstance(payload["exp"], int)
    assert set(body) == {"access_token", "token_type"}


def test_sesion_actual_devuelve_rol_y_comercio(client):
    test_client, fake_session = client
    user = make_user()
    fake_session.user = user

    response = test_client.get(
        "/api/v1/auth/me",
        headers=auth_header(create_access_token(sub=str(user.id), rol=user.rol.value)),
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": str(user.id),
        "nombre": user.nombre,
        "email": user.email,
        "rol": "fundacion",
        "comercio_id": None,
        "comercio_nombre": None,
    }


@pytest.mark.parametrize(
    "user_kwargs,password",
    [
        ({"email": "missing@example.com"}, "correct-password"),
        ({"email": "user@example.com"}, "wrong-password"),
        ({"email": "user@example.com", "activo": False}, "correct-password"),
    ],
)
def test_login_credenciales_invalidas_mismo_error(client, user_kwargs, password):
    test_client, fake_session = client
    fake_session.user = None if user_kwargs["email"] == "missing@example.com" else make_user(**user_kwargs)

    response = test_client.post(
        "/api/v1/auth/login",
        json={"email": user_kwargs["email"], "password": password},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Credenciales inválidas"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_login_normaliza_email(client):
    test_client, fake_session = client
    fake_session.user = make_user(email="user@example.com")

    response = test_client.post(
        "/api/v1/auth/login",
        json={"email": "  USER@EXAMPLE.COM  ", "password": "correct-password"},
    )

    assert response.status_code == 200


def test_registro_comercio_guarda_la_cuenta_y_el_comercio(client):
    test_client, fake_session = client

    response = test_client.post(
        "/api/v1/auth/register",
        json={
            "nombre": "Tienda de prueba",
            "email": "tienda@example.com",
            "password": "secure-password",
            "rol": "comercio",
            "direccion": "Calle 1",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"mensaje": "Registro completado", "aprobado": False}
    assert fake_session.commits == 1
    assert len(fake_session.added) == 2
    assert fake_session.added[0].nombre == "Tienda de prueba"
    assert fake_session.added[1].email == "tienda@example.com"
    assert fake_session.added[1].comercio_id == fake_session.added[0].id


def test_password_hash_no_es_texto_plano():
    password_hash = hash_password("secret")
    assert password_hash.startswith("$argon2")
    assert password_hash != "secret"


def test_ruta_sin_token_devuelve_401(client):
    test_client, _fake_session = client
    response = test_client.get("/_solo_fundacion")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "token_factory",
    [
        lambda: "not-a-token",
        lambda: create_access_token(sub=str(uuid4()), rol="fundacion")[:-1] + "x",
        lambda: jwt.encode({"sub": str(uuid4())}, "test-secret-that-is-long-enough-for-tests", algorithm=ALGORITHM),
        lambda: jwt.encode(
            {"sub": str(uuid4()), "rol": "fundacion", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
            "test-secret-that-is-long-enough-for-tests",
            algorithm=ALGORITHM,
        ),
        lambda: jwt.encode(
            {"sub": str(uuid4()), "rol": "fundacion", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
            "another-secret",
            algorithm=ALGORITHM,
        ),
        lambda: create_access_token(sub="not-a-uuid", rol="fundacion"),
    ],
)
def test_token_invalido_devuelve_401(client, token_factory):
    test_client, fake_session = client
    fake_session.user = make_user()
    response = test_client.get("/_solo_fundacion", headers=auth_header(token_factory()))
    assert response.status_code == 401


@pytest.mark.parametrize("activo", [True, False])
def test_usuario_inexistente_o_inactivo_devuelve_401(client, activo):
    test_client, fake_session = client
    user = make_user(activo=activo)
    token = create_access_token(sub=str(user.id), rol="fundacion")
    fake_session.user = None if activo else user

    response = test_client.get("/_solo_fundacion", headers=auth_header(token))

    assert response.status_code == 401


def test_rol_no_permitido_y_permitido(client):
    test_client, fake_session = client
    user = make_user(rol=UsuarioRol.VOLUNTARIO)
    fake_session.user = user
    token = create_access_token(sub=str(user.id), rol="voluntario")
    assert test_client.get("/_solo_fundacion", headers=auth_header(token)).status_code == 403

    user.rol = UsuarioRol.FUNDACION
    token = create_access_token(sub=str(user.id), rol="fundacion")
    assert test_client.get("/_solo_fundacion", headers=auth_header(token)).status_code == 200


def test_rol_efectivo_sale_de_la_bd(client):
    test_client, fake_session = client
    user = make_user(rol=UsuarioRol.VOLUNTARIO)
    fake_session.user = user
    token = create_access_token(sub=str(user.id), rol="fundacion")

    response = test_client.get("/_solo_fundacion", headers=auth_header(token))

    assert response.status_code == 403


def test_require_role_rechaza_rol_invalido():
    with pytest.raises(ValueError):
        require_role("rol_invalido")
    with pytest.raises(ValueError):
        require_role()


def test_admin_solo_aprueba_cuentas_pendientes_de_comercio_o_fundacion():
    cuenta_pendiente = SimpleNamespace(rol=UsuarioRol.COMERCIO, estado=UsuarioEstado.PENDIENTE)
    _validate_pending_approval(cuenta_pendiente)

    cuenta_de_voluntario = SimpleNamespace(rol=UsuarioRol.VOLUNTARIO, estado=UsuarioEstado.PENDIENTE)
    with pytest.raises(HTTPException) as error:
        _validate_pending_approval(cuenta_de_voluntario)
    assert error.value.status_code == 403

    cuenta_aprobada = SimpleNamespace(rol=UsuarioRol.FUNDACION, estado=UsuarioEstado.APROBADO)
    with pytest.raises(HTTPException) as error:
        _validate_pending_approval(cuenta_aprobada)
    assert error.value.status_code == 409


def test_admin_no_puede_gestionar_usuarios_fuera_de_su_alcance():
    cuenta_de_organizacion = SimpleNamespace(rol=UsuarioRol.ORGANIZACION)
    with pytest.raises(HTTPException) as error:
        _validate_admin_managed_account(cuenta_de_organizacion)
    assert error.value.status_code == 403


def test_fundacion_solo_puede_gestionar_cuentas_de_comercios(client):
    test_client, fake_session = client
    user = make_user(rol=UsuarioRol.VOLUNTARIO)
    fake_session.user = user
    token = create_access_token(sub=str(user.id), rol=user.rol.value)

    response = test_client.get("/api/v1/fundacion/comercios", headers=auth_header(token))
    assert response.status_code == 403

    with pytest.raises(HTTPException) as error:
        _validate_comercio(SimpleNamespace(rol=UsuarioRol.FUNDACION))
    assert error.value.status_code == 403

    _validate_comercio(SimpleNamespace(rol=UsuarioRol.COMERCIO))


def test_fundacion_puede_aprobar_desactivar_y_reactivar_comercio(client):
    test_client, fake_session = client
    fundacion = make_user(rol=UsuarioRol.FUNDACION)
    comercio = make_user(rol=UsuarioRol.COMERCIO)
    comercio.estado = UsuarioEstado.PENDIENTE
    comercio.motivo_rechazo = None
    fake_session.user = fundacion
    fake_session.target_user = comercio
    headers = auth_header(create_access_token(sub=str(fundacion.id), rol=fundacion.rol.value))
    url = f"/api/v1/fundacion/comercios/{comercio.id}"

    response = test_client.post(f"{url}/aprobar", headers=headers)
    assert response.status_code == 200
    assert comercio.estado == UsuarioEstado.APROBADO
    assert comercio.estado_actualizado_por == fundacion.id

    response = test_client.post(f"{url}/desactivar", headers=headers)
    assert response.status_code == 200
    assert comercio.estado == UsuarioEstado.INACTIVO
    assert comercio.activo is False

    response = test_client.post(f"{url}/reactivar", headers=headers)
    assert response.status_code == 200
    assert comercio.estado == UsuarioEstado.APROBADO
    assert comercio.activo is True


def test_fundacion_no_puede_modificar_otra_cuenta(client):
    test_client, fake_session = client
    fundacion = make_user(rol=UsuarioRol.FUNDACION)
    otra_fundacion = make_user(rol=UsuarioRol.FUNDACION)
    otra_fundacion.estado = UsuarioEstado.PENDIENTE
    fake_session.user = fundacion
    fake_session.target_user = otra_fundacion
    headers = auth_header(create_access_token(sub=str(fundacion.id), rol=fundacion.rol.value))

    response = test_client.post(
        f"/api/v1/fundacion/comercios/{otra_fundacion.id}/aprobar",
        headers=headers,
    )
    assert response.status_code == 403


def test_secreto_vacio_falla(monkeypatch):
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "jwt_secret", "")
    with pytest.raises(RuntimeError, match="JWT_SECRET no configurado"):
        create_access_token(sub=str(uuid4()), rol="fundacion")
    with pytest.raises(RuntimeError, match="JWT_SECRET no configurado"):
        decode_token("token")
