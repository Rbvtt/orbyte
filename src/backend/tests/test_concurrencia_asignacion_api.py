"""Evidencia PostgreSQL de la carrera de asignación solicitada en #13."""

import asyncio
from datetime import datetime, timezone
from uuid import UUID, uuid4

from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

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


def _crear_rescate(real_db, fundacion: Usuario, comercio: Comercio) -> Rescate:
    rescate = Rescate(
        comercio_id=comercio.id,
        alimento="Pan",
        cantidad_aprox="20 unidades",
        lugar_recogida="Calle 1",
        hora_limite=datetime(2026, 12, 1, 20, 0, tzinfo=timezone.utc),
        registrado_por=fundacion.id,
        estado=RescateEstado.DISPONIBLE,
    )
    real_db.add(rescate)
    real_db.commit()
    return rescate


def test_asignacion_api_tiene_un_ganador_en_20_rondas(real_db):
    comercio = Comercio(nombre=f"Comercio {uuid4()}", direccion="Calle 1")
    organizacion = OrganizacionReceptora(nombre=f"Organizacion {uuid4()}", direccion="Carrera 2")
    fundacion = Usuario(
        id=uuid4(),
        nombre="Fundacion QA",
        email=f"{uuid4()}@example.com",
        password_hash="irrelevante",
        rol=UsuarioRol.FUNDACION,
        activo=True,
    )
    voluntarios = [
        Usuario(
            id=uuid4(),
            nombre=f"Voluntario {indice}",
            email=f"{uuid4()}@example.com",
            password_hash="irrelevante",
            rol=UsuarioRol.VOLUNTARIO,
            activo=True,
        )
        for indice in range(10)
    ]
    real_db.add_all([comercio, organizacion, fundacion, *voluntarios])
    real_db.flush()
    real_db.add_all([Voluntario(usuario_id=usuario.id) for usuario in voluntarios])
    real_db.commit()

    sesiones = sessionmaker(bind=real_db.get_bind(), autoflush=False, expire_on_commit=False)

    def override_get_db():
        with sesiones() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    token = create_access_token(sub=str(fundacion.id), rol=UsuarioRol.FUNDACION.value)
    headers = {"Authorization": f"Bearer {token}"}

    async def ejecutar_rondas():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as cliente:
            for ronda in range(20):
                rescate = _crear_rescate(real_db, fundacion, comercio)
                async def asignar(voluntario: Usuario):
                    return await cliente.patch(
                        f"/api/v1/rescates/{rescate.id}/asignacion",
                        headers=headers,
                        json={
                            "organizacion_id": str(organizacion.id),
                            "voluntario_id": str(voluntario.id),
                        },
                    )

                respuestas = await asyncio.gather(*(asignar(voluntario) for voluntario in voluntarios))
                exitosas = [respuesta for respuesta in respuestas if respuesta.status_code == 200]
                conflictos = [respuesta for respuesta in respuestas if respuesta.status_code == 409]
                assert len(exitosas) == 1, f"Ronda {ronda + 1}: se esperaba exactamente un 200"
                assert len(conflictos) == 9, f"Ronda {ronda + 1}: se esperaban nueve 409"

                real_db.expire_all()
                persistido = real_db.get(Rescate, rescate.id)
                voluntario_ganador = UUID(exitosas[0].json()["voluntario_id"])
                assert persistido.estado == RescateEstado.ASIGNADO
                assert persistido.voluntario_id == voluntario_ganador
                assert real_db.scalar(
                    select(func.count()).select_from(RescateHistorial).where(
                        RescateHistorial.rescate_id == rescate.id,
                        RescateHistorial.estado_anterior == RescateEstado.DISPONIBLE,
                        RescateHistorial.estado_nuevo == RescateEstado.ASIGNADO,
                    )
                ) == 1

    try:
        asyncio.run(ejecutar_rondas())
    finally:
        app.dependency_overrides.clear()
