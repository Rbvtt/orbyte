"""Consulta de impacto (#20 · CA-05.1, CA-05.3) contra PostgreSQL."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text

from app.models import (
    Comercio,
    OrganizacionReceptora,
    Rescate,
    RescateEstado,
    Usuario,
    UsuarioRol,
    Voluntario,
)
from app.services.impacto import ZONA_COLOMBIA, calcular_impacto, rango_de_fechas

# Un periodo lejano para no mezclarse con datos de otras pruebas.
INICIO = datetime(2031, 3, 1, tzinfo=timezone.utc)
FIN = datetime(2031, 4, 1, tzinfo=timezone.utc)


def _usuario(rol: UsuarioRol, **kwargs) -> Usuario:
    return Usuario(
        id=uuid4(),
        nombre=f"Impacto {rol.value}",
        email=f"{uuid4()}@example.com",
        password_hash="irrelevante",
        rol=rol,
        activo=True,
        **kwargs,
    )


@pytest.fixture
def crear_rescate(real_db):
    comercio = Comercio(nombre=f"Comercio impacto {uuid4()}", direccion="Calle 1")
    organizaciones = [
        OrganizacionReceptora(nombre=f"Organizacion impacto {uuid4()}", direccion="Carrera 2")
        for _ in range(3)
    ]
    real_db.add_all([comercio, *organizaciones])
    real_db.flush()
    fundacion = _usuario(UsuarioRol.FUNDACION)
    voluntario = _usuario(UsuarioRol.VOLUNTARIO)
    real_db.add_all([fundacion, voluntario])
    real_db.flush()
    real_db.add(Voluntario(usuario_id=voluntario.id, disponibilidad="disponible"))
    real_db.flush()

    def crear(
        estado=RescateEstado.ENTREGADO,
        entregado_en=INICIO + timedelta(days=1),
        organizacion=0,
        cantidad=10,
        unidad="kg",
        personas=5,
    ) -> Rescate:
        con_voluntario = estado in {
            RescateEstado.ASIGNADO,
            RescateEstado.RECOGIDO,
            RescateEstado.ENTREGADO,
        }
        rescate = Rescate(
            comercio_id=comercio.id,
            alimento="Pan",
            cantidad_aprox="10 kg",
            lugar_recogida="Bodega",
            hora_limite=INICIO,
            estado=estado,
            registrado_por=fundacion.id,
            organizacion_id=organizaciones[organizacion].id if con_voluntario else None,
            voluntario_id=voluntario.id if con_voluntario else None,
            motivo_no_completado="Prueba" if estado == RescateEstado.NO_COMPLETADO else None,
            entregado_en=entregado_en,
            recibido_por=fundacion.id,
            cantidad_recibida=cantidad,
            unidad_recibida=unidad,
            es_medida=unidad == "kg",
            personas_beneficiadas=personas,
        )
        real_db.add(rescate)
        real_db.commit()
        return rescate

    return crear


def test_solo_cuentan_los_rescates_entregados_del_periodo(real_db, crear_rescate):
    crear_rescate(cantidad=10, personas=5, organizacion=0)
    crear_rescate(cantidad=Decimal("2.5"), personas=3, organizacion=0)
    crear_rescate(cantidad=4, personas=2, organizacion=1)
    # Cantidad estimada: no suma a los kilogramos, sí a personas y organizaciones.
    crear_rescate(cantidad=7, unidad="aproximada", personas=1, organizacion=2)
    # No cuentan: otros estados con datos de recepción y entregas fuera del periodo.
    crear_rescate(estado=RescateEstado.RECOGIDO, cantidad=100, personas=100, organizacion=1)
    crear_rescate(estado=RescateEstado.NO_COMPLETADO, cantidad=100, personas=100)
    crear_rescate(entregado_en=INICIO - timedelta(seconds=1), cantidad=100, personas=100)
    crear_rescate(entregado_en=FIN, cantidad=100, personas=100)

    totales = calcular_impacto(real_db, INICIO, FIN)

    assert totales.kilogramos == Decimal("16.5")
    assert totales.personas_beneficiadas == 11
    assert totales.organizaciones == 3
    assert totales.kilogramos_estimados == Decimal("7")
    assert totales.rescates_entregados == 4
    assert totales.rescates_estimados == 1


def test_el_inicio_del_periodo_se_incluye(real_db, crear_rescate):
    crear_rescate(entregado_en=INICIO, cantidad=3, personas=2)
    totales = calcular_impacto(real_db, INICIO, FIN)
    assert totales.kilogramos == Decimal("3")
    assert totales.rescates_entregados == 1


def test_beneficiados_sin_registrar_no_rompen_la_suma(real_db, crear_rescate):
    crear_rescate(cantidad=3, personas=None)
    crear_rescate(cantidad=2, personas=4)
    totales = calcular_impacto(real_db, INICIO, FIN)
    assert totales.personas_beneficiadas == 4


def test_periodo_sin_entregas_devuelve_ceros(real_db, crear_rescate):
    crear_rescate(estado=RescateEstado.RECOGIDO)
    crear_rescate(entregado_en=FIN + timedelta(days=3))

    totales = calcular_impacto(real_db, INICIO, FIN)

    assert totales.kilogramos == 0
    assert totales.personas_beneficiadas == 0
    assert totales.organizaciones == 0
    assert totales.kilogramos_estimados == 0
    assert totales.rescates_entregados == 0
    assert totales.rescates_estimados == 0


def test_la_consulta_tiene_su_indice(real_db):
    definicion = real_db.scalar(
        text("SELECT indexdef FROM pg_indexes WHERE indexname = 'rescates_estado_entregado_en_idx'")
    )
    assert definicion is not None
    assert "(estado, entregado_en)" in definicion


@pytest.mark.parametrize(
    ("desde", "hasta"),
    [
        (FIN, INICIO),
        (INICIO, INICIO),
        (INICIO.replace(tzinfo=None), FIN),
    ],
)
def test_periodo_invalido(desde, hasta):
    with pytest.raises(ValueError):
        calcular_impacto(None, desde, hasta)


def test_rango_de_fechas_usa_dias_completos_de_colombia():
    inicio, fin = rango_de_fechas(date(2026, 11, 1), date(2026, 11, 30))
    assert inicio == datetime(2026, 11, 1, 5, 0, tzinfo=timezone.utc)
    assert fin == datetime(2026, 12, 1, 5, 0, tzinfo=timezone.utc)
    assert inicio.tzinfo is ZONA_COLOMBIA


def test_rango_de_un_solo_dia():
    inicio, fin = rango_de_fechas(date(2026, 11, 14), date(2026, 11, 14))
    assert fin - inicio == timedelta(days=1)


def test_rango_de_fechas_invertido():
    with pytest.raises(ValueError):
        rango_de_fechas(date(2026, 11, 30), date(2026, 11, 1))
