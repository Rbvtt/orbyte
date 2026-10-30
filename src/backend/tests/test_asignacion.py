import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.models import (
    Comercio,
    OrganizacionReceptora,
    Rescate,
    RescateEstado,
    Usuario,
    UsuarioRol,
    Voluntario,
)
from app.services.rescates import asignar_rescate


def _crear_rescate_y_datos(real_db: Session, cantidad_voluntarios: int = 1):
    comercio = Comercio(nombre=f"Comercio {uuid4()}", direccion="Calle 1")
    organizacion = OrganizacionReceptora(
        nombre=f"Organizacion {uuid4()}",
        direccion="Calle 2",
    )
    fundacion = Usuario(
        id=uuid4(),
        nombre="Fundacion de prueba",
        email=f"{uuid4()}@example.com",
        password_hash="irrelevante",
        rol=UsuarioRol.FUNDACION,
        activo=True,
    )
    voluntarios = []
    for _ in range(cantidad_voluntarios):
        usuario = Usuario(
            id=uuid4(),
            nombre="Voluntario de prueba",
            email=f"{uuid4()}@example.com",
            password_hash="irrelevante",
            rol=UsuarioRol.VOLUNTARIO,
            activo=True,
        )
        voluntarios.append(usuario)
        real_db.add(Voluntario(usuario_id=usuario.id))

    real_db.add_all([comercio, organizacion, fundacion, *voluntarios])
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
    return rescate.id, organizacion.id, fundacion.id, [usuario.id for usuario in voluntarios]


def test_asignaciones_concurrentes_solo_dejan_un_ganador(real_db):
    rescate_id, organizacion_id, asignado_por, voluntarios = _crear_rescate_y_datos(
        real_db, cantidad_voluntarios=10
    )
    engine = real_db.get_bind()
    sesiones = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    barrera = Barrier(len(voluntarios))

    def asignar(voluntario_id):
        barrera.wait()
        with sesiones() as db:
            return voluntario_id, asignar_rescate(
                db,
                rescate_id,
                voluntario_id,
                organizacion_id,
                asignado_por,
            )

    with ThreadPoolExecutor(max_workers=len(voluntarios)) as executor:
        resultados = list(executor.map(asignar, voluntarios))

    exitosos = [voluntario_id for voluntario_id, exito in resultados if exito]
    assert len(exitosos) == 1
    assert sum(exito for _, exito in resultados) == 1

    real_db.expire_all()
    rescate = real_db.get(Rescate, rescate_id)
    assert rescate is not None
    assert rescate.voluntario_id == exitosos[0]
    assert rescate.estado == RescateEstado.ASIGNADO


def test_asignar_rescate_no_disponible_devuelve_conflicto(real_db):
    rescate_id, organizacion_id, asignado_por, voluntarios = _crear_rescate_y_datos(
        real_db, cantidad_voluntarios=2
    )
    assert asignar_rescate(
        real_db,
        rescate_id,
        voluntarios[0],
        organizacion_id,
        asignado_por,
    )

    resultado = asignar_rescate(
        real_db,
        rescate_id,
        voluntarios[1],
        organizacion_id,
        asignado_por,
    )

    assert resultado is False


def test_check_impide_estado_avanzado_sin_voluntario(real_db):
    rescate_id, _organizacion_id, _asignado_por, _voluntarios = _crear_rescate_y_datos(
        real_db
    )

    with pytest.raises(IntegrityError):
        real_db.execute(
            text(
                """
                UPDATE rescates
                SET estado = 'asignado', voluntario_id = NULL
                WHERE id = :rescate_id
                """
            ),
            {"rescate_id": rescate_id},
        )
        real_db.commit()

    real_db.rollback()
    estado = real_db.scalar(
        select(Rescate.estado).where(Rescate.id == rescate_id)
    )
    assert estado == RescateEstado.DISPONIBLE


def test_migracion_asignacion_atomica_es_reversible(real_db):
    database_url = os.environ["TEST_DATABASE_URL"]
    backend_dir = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url

    subprocess.run(
        [sys.executable, "-m", "alembic", "downgrade", "0002"],
        cwd=backend_dir,
        env=env,
        check=True,
    )
    try:
        assert real_db.scalar(
            text(
                """
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'chk_rescates_estado_requiere_voluntario'
                """
            )
        ) is None
    finally:
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=backend_dir,
            env=env,
            check=True,
        )
