from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient

from app.database import get_db
from app.deps import require_role
from app.main import app
from app.models import UsuarioRol
from app.security import ALGORITHM, create_access_token, decode_token, hash_password


class FakeSession:
    def __init__(self, user=None):
        self.user = user

    def scalar(self, _statement):
        return self.user

    def get(self, _model, _identifier):
        return self.user


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


def test_secreto_vacio_falla(monkeypatch):
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "jwt_secret", "")
    with pytest.raises(RuntimeError, match="JWT_SECRET no configurado"):
        create_access_token(sub=str(uuid4()), rol="fundacion")
    with pytest.raises(RuntimeError, match="JWT_SECRET no configurado"):
        decode_token("token")
