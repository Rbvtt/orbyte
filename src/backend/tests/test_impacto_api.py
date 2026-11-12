from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.main import app


class FakeResult:
    def __init__(self, row=None, rows=None):
        self.row = row
        self.rows = rows or []

    def one(self):
        return self.row

    def mappings(self):
        return self

    def all(self):
        return self.rows

    def __iter__(self):
        return iter(self.rows)


class FakeImpactoSession:
    def execute(self, statement, _params):
        query = str(statement)
        if "AS kilogramos" in query:
            return FakeResult(
                row=SimpleNamespace(
                    kilogramos=Decimal("12.50"),
                    kilogramos_estimados=Decimal("4.00"),
                    personas_beneficiadas=17,
                    organizaciones=2,
                    rescates_entregados=3,
                    rescates_estimados=1,
                )
            )
        if "SELECT DISTINCT o.id" in query:
            return FakeResult(
                rows=[
                    {"id": uuid4(), "nombre": "Banco de alimentos"},
                    {"id": uuid4(), "nombre": "Comedor comunitario"},
                ]
            )
        if "AND TRUE" in query:
            organizacion_id = uuid4()
            return FakeResult(
                rows=[
                    {
                        "id": uuid4(),
                        "entregado_en": datetime(
                            2026, 11, 1, 15, tzinfo=timezone.utc
                        ),
                        "comercio": "Mercado",
                        "organizacion_id": organizacion_id,
                        "organizacion": "Banco de alimentos",
                        "cantidad_recibida": Decimal("12.50"),
                        "unidad_recibida": "kg",
                        "es_medida": True,
                        "personas_beneficiadas": 17,
                    },
                    {
                        "id": uuid4(),
                        "entregado_en": datetime(
                            2026, 11, 2, 15, tzinfo=timezone.utc
                        ),
                        "comercio": "Mercado",
                        "organizacion_id": uuid4(),
                        "organizacion": "Comedor comunitario",
                        "cantidad_recibida": Decimal("3.00"),
                        "unidad_recibida": "kg",
                        "es_medida": True,
                        "personas_beneficiadas": 5,
                    },
                ]
            )
        return FakeResult(
            rows=[
                {
                    "id": uuid4(),
                    "entregado_en": datetime(2026, 11, 1, 15, tzinfo=timezone.utc),
                    "comercio": "Mercado",
                    "organizacion_id": uuid4(),
                    "organizacion": "Banco de alimentos",
                    "cantidad_recibida": Decimal("12.50"),
                    "unidad_recibida": "kg",
                    "es_medida": True,
                    "personas_beneficiadas": 17,
                }
            ]
        )


@pytest.fixture
def impacto_client():
    usuario = SimpleNamespace(rol="fundacion", usuario_id=uuid4(), sub="")
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=str(usuario.usuario_id),
        rol=usuario.rol,
        usuario_id=usuario.usuario_id,
    )
    app.dependency_overrides[get_db] = FakeImpactoSession
    with TestClient(app) as client:
        yield client, usuario
    app.dependency_overrides.clear()


def test_get_impacto_devuelve_totales_y_organizaciones(impacto_client):
    client, _usuario = impacto_client

    response = client.get(
        "/api/v1/impacto",
        params={"desde": "2026-11-01", "hasta": "2026-11-30"},
    )
    assert response.status_code == 200
    assert response.status_code == 200
    body = response.json()
    assert body["kg_total"] == 12.5
    assert body["personas_total"] == 17
    assert [item["nombre"] for item in body["organizaciones"]] == [
        "Banco de alimentos",
        "Comedor comunitario",
    ]
    assert body["rescates_sin_kg"] == 1


def test_detalle_impacto_incluye_rescates_y_valor_que_suma_al_total(impacto_client):
    client, _usuario = impacto_client

    response = client.get(
        "/api/v1/impacto/detalle",
        params={
            "metrica": "kg",
            "desde": "2026-11-01",
            "hasta": "2026-11-30",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["metrica"] == "kg"
    assert body["total"] == 12.5
    assert sum(rescate["valor"] for rescate in body["rescates"]) == body["total"]
    assert body["rescates"][0]["comercio"] == "Mercado"
    assert body["rescates"][0]["unidad_recibida"] == "kg"


def test_detalle_organizaciones_agrupa_rescates_y_suma_al_total(impacto_client):
    client, _usuario = impacto_client

    response = client.get(
        "/api/v1/impacto/detalle",
        params={
            "metrica": "organizaciones",
            "desde": "2026-11-01",
            "hasta": "2026-11-30",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert sum(organizacion["valor"] for organizacion in body["organizaciones"]) == 2
    assert [len(organizacion["rescates"]) for organizacion in body["organizaciones"]] == [1, 1]


def test_impacto_requiere_rol_fundacion(impacto_client):
    client, usuario = impacto_client
    usuario.rol = "organizacion"

    response = client.get(
        "/api/v1/impacto",
        params={"desde": "2026-11-01", "hasta": "2026-11-30"},
    )

    assert response.status_code == 403


def test_impacto_rechaza_periodo_invertido(impacto_client):
    client, _usuario = impacto_client

    response = client.get(
        "/api/v1/impacto",
        params={"desde": "2026-11-30", "hasta": "2026-11-01"},
    )

    assert response.status_code == 422


def test_detalle_impacto_rechaza_metrica_desconocida(impacto_client):
    client, _usuario = impacto_client

    response = client.get(
        "/api/v1/impacto/detalle",
        params={
            "metrica": "desconocida",
            "desde": "2026-11-01",
            "hasta": "2026-11-30",
        },
    )

    assert response.status_code == 422
