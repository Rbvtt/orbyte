"""Protecciones que solo aplican con ENTORNO=produccion (#28)."""
from types import SimpleNamespace

import pytest

from app.config import CONTRASENA_ADMIN_DESARROLLO, Settings
from app.services import bootstrap


class FakeSession:
    def __init__(self):
        self.agregados = []

    def scalar(self, _consulta):
        return None

    def add(self, usuario):
        self.agregados.append(usuario)

    def commit(self):
        pass


def _crear_admin(monkeypatch, entorno, contrasena):
    ajustes = SimpleNamespace(
        es_produccion=entorno == "produccion",
        default_admin_email="admin@example.com",
        default_admin_password=contrasena,
    )
    monkeypatch.setattr(bootstrap, "get_settings", lambda: ajustes)
    db = FakeSession()
    bootstrap.ensure_seed_admin(db)
    return db.agregados


@pytest.mark.parametrize("contrasena", [CONTRASENA_ADMIN_DESARROLLO, "", "   "])
def test_produccion_no_crea_admin_con_contrasena_insegura(monkeypatch, contrasena):
    assert _crear_admin(monkeypatch, "produccion", contrasena) == []


def test_produccion_crea_admin_con_contrasena_propia(monkeypatch):
    assert len(_crear_admin(monkeypatch, "produccion", "una-clave-propia-y-larga")) == 1


def test_desarrollo_conserva_el_admin_por_defecto(monkeypatch):
    assert len(_crear_admin(monkeypatch, "desarrollo", CONTRASENA_ADMIN_DESARROLLO)) == 1


def test_cors_de_localhost_solo_en_desarrollo():
    assert Settings(_env_file=None, entorno="desarrollo").cors_origin_regex is not None
    assert Settings(_env_file=None, entorno="produccion").cors_origin_regex is None
    assert Settings(_env_file=None, entorno=" Produccion ").cors_origin_regex is None
