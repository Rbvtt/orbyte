"""Datos ficticios para recorrer CMP-01 a CMP-05 en el Demo (#26).

Crea comercios, organizaciones receptoras, cuentas por rol y 15 rescates repartidos en los
5 estados, con su historial y con entregas en dos periodos para la consulta de impacto.
Es idempotente: los registros tienen UUID fijos y no se duplican ni se sobrescriben.

Uso, desde src/backend y con las migraciones aplicadas:

    $env:SEED_DEMO_PASSWORD = "<clave-de-las-cuentas-demo>"
    python -m scripts.seed_demo

Para una base con ENTORNO=produccion hay que agregar --produccion. Ojo: historial_estados es de
solo inserción, así que estos datos no se pueden borrar fila por fila después.
"""

import argparse
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid5

from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models import (
    Comercio,
    OrganizacionReceptora,
    Rescate,
    RescateEstado,
    RescateHistorial,
    Usuario,
    UsuarioEstado,
    UsuarioRol,
    Voluntario,
)
from app.security import hash_password

ESPACIO = UUID("6f1d0b4e-5c2a-4c55-9a0e-0d3c1e7a2b26")
# example.com está reservado para ejemplos; el validador de correos rechaza dominios como .invalid.
DOMINIO = "example.com"


def uid(clave: str) -> UUID:
    return uuid5(ESPACIO, clave)


COMERCIOS = {
    "panaderia": ("Panadería La Espiga (demo)", "Calle 5 # 20-10, Cali", "602 555 0101"),
    "supermercado": ("Supermercado El Ahorro (demo)", "Carrera 15 # 8-40, Cali", "602 555 0102"),
    "restaurante": ("Restaurante Sabor Casero (demo)", "Avenida 6N # 25-30, Cali", "602 555 0103"),
}

# Las mismas organizaciones de docs/datos/cmp02/organizaciones.csv, con sus UUID.
ORGANIZACIONES = {
    "A": (UUID("00000000-0000-4000-8000-000000000201"), "Organización Demo A", "Punto ficticio A",
          Decimal("80.00"), True, "Lunes a viernes 08:00-12:00", True),
    "B": (UUID("00000000-0000-4000-8000-000000000202"), "Organización Demo B", "Punto ficticio B",
          Decimal("25.00"), False, "Lunes a sábado 14:00-17:00", False),
    "C": (UUID("00000000-0000-4000-8000-000000000203"), "Organización Demo C", "Punto ficticio C",
          Decimal("0.00"), False, "Sin disponibilidad temporal", False),
}

# Los mismos voluntarios de docs/datos/cmp02/voluntarios.csv, con sus UUID.
VOLUNTARIOS = {
    "A": (UUID("00000000-0000-4000-8000-000000000301"), "Voluntario Demo A", "Bicicleta",
          "Lunes a viernes 08:00-12:00"),
    "B": (UUID("00000000-0000-4000-8000-000000000302"), "Voluntario Demo B", "Automóvil",
          "Lunes a sábado 14:00-17:00"),
    "C": (UUID("00000000-0000-4000-8000-000000000303"), "Voluntario Demo C", "A pie",
          "Sin disponibilidad temporal"),
}


@dataclass(frozen=True)
class RescateDemo:
    clave: str
    comercio: str
    alimento: str
    cantidad_aprox: str
    estado: RescateEstado
    # Horas respecto al momento de cargar los datos (negativo = en el pasado).
    creado: float
    hora_limite: float
    por_comercio: bool = True
    organizacion: str | None = None
    voluntario: str | None = None
    recibido: tuple[Decimal, str, int] | None = None  # cantidad, unidad, personas
    motivo: str | None = None


H = 1.0
D = 24.0
RESCATES = [
    # disponible: pendientes de asignar, con hora límite futura.
    RescateDemo("d1", "panaderia", "Pan del día", "15 kg", RescateEstado.DISPONIBLE, -2 * H, 6 * H),
    RescateDemo("d2", "supermercado", "Frutas y verduras", "30 kg", RescateEstado.DISPONIBLE, -1 * H, 20 * H),
    RescateDemo("d3", "restaurante", "Almuerzos preparados", "25 porciones", RescateEstado.DISPONIBLE,
                -3 * H, 4 * H, por_comercio=False),
    RescateDemo("d4", "supermercado", "Lácteos próximos a vencer", "12 kg", RescateEstado.DISPONIBLE,
                -0.5 * H, 28 * H),
    # asignado: con organización y voluntario.
    RescateDemo("a1", "panaderia", "Pan y galletas", "10 kg", RescateEstado.ASIGNADO, -5 * H, 3 * H,
                organizacion="A", voluntario="A"),
    RescateDemo("a2", "supermercado", "Granos y enlatados", "40 kg", RescateEstado.ASIGNADO, -6 * H, 8 * H,
                organizacion="B", voluntario="B"),
    RescateDemo("a3", "restaurante", "Sopas y arroz", "20 porciones", RescateEstado.ASIGNADO, -4 * H, 5 * H,
                por_comercio=False, organizacion="A", voluntario="B"),
    # recogido: el voluntario ya lo entregó; falta que la organización confirme.
    RescateDemo("r1", "supermercado", "Verduras", "18 kg", RescateEstado.RECOGIDO, -9 * H, -1 * H,
                organizacion="A", voluntario="A"),
    RescateDemo("r2", "panaderia", "Pan tajado", "8 kg", RescateEstado.RECOGIDO, -8 * H, -2 * H,
                organizacion="B", voluntario="B"),
    # entregado: dos en el periodo anterior y dos recientes, una con cantidad estimada.
    RescateDemo("e1", "supermercado", "Frutas", "35 kg", RescateEstado.ENTREGADO, -36 * D, -35.8 * D,
                organizacion="A", voluntario="A", recibido=(Decimal("32.5"), "kg", 45)),
    RescateDemo("e2", "panaderia", "Pan del día", "20 kg", RescateEstado.ENTREGADO, -30 * D, -29.8 * D,
                organizacion="B", voluntario="B", recibido=(Decimal("18"), "kg", 30)),
    RescateDemo("e3", "restaurante", "Almuerzos preparados", "40 porciones", RescateEstado.ENTREGADO,
                -6 * D, -5.8 * D, por_comercio=False, organizacion="A", voluntario="B",
                recibido=(Decimal("15"), "aprox", 40)),
    RescateDemo("e4", "supermercado", "Lácteos y huevos", "25 kg", RescateEstado.ENTREGADO, -2 * D, -1.8 * D,
                organizacion="A", voluntario="A", recibido=(Decimal("24.2"), "kg", 35)),
    # no_completado: uno cancelado por el comercio y otro cerrado por la fundación.
    RescateDemo("n1", "panaderia", "Tortas", "5 kg", RescateEstado.NO_COMPLETADO, -3 * D, -2.8 * D,
                motivo="Cancelado por el comercio"),
    RescateDemo("n2", "restaurante", "Bandejas de comida", "15 porciones", RescateEstado.NO_COMPLETADO,
                -4 * D, -3.9 * D, por_comercio=False, organizacion="B", voluntario="A",
                motivo="El voluntario no pudo llegar antes de la hora límite"),
]


def _usuario(db, clave, nombre, rol, clave_hash, **extra) -> Usuario:
    email = f"demo-{clave}@{DOMINIO}"
    existente = db.scalar(select(Usuario).where(Usuario.email == email))
    if existente is not None:
        return existente
    usuario = Usuario(
        id=extra.pop("id", None) or uid(f"usuario:{clave}"),
        nombre=nombre,
        email=email,
        password_hash=clave_hash,
        rol=rol,
        estado=UsuarioEstado.APROBADO,
        activo=True,
        **extra,
    )
    db.add(usuario)
    db.flush()
    return usuario


def _cargar(db, contrasena: str) -> dict[str, int]:
    clave_hash = hash_password(contrasena)
    creados = {"rescates": 0}

    comercios = {}
    for clave, (nombre, direccion, telefono) in COMERCIOS.items():
        comercio = db.get(Comercio, uid(f"comercio:{clave}"))
        if comercio is None:
            comercio = Comercio(id=uid(f"comercio:{clave}"), nombre=nombre, direccion=direccion,
                                telefono=telefono)
            db.add(comercio)
        comercios[clave] = comercio

    organizaciones = {}
    for clave, (id_, nombre, direccion, capacidad, refrigeracion, horario, recoge) in ORGANIZACIONES.items():
        organizacion = db.get(OrganizacionReceptora, id_)
        if organizacion is None:
            organizacion = OrganizacionReceptora(
                id=id_, nombre=nombre, direccion=direccion, capacidad_kg=capacidad,
                refrigeracion=refrigeracion, horario_recepcion=horario, puede_recoger=recoge,
            )
            db.add(organizacion)
        organizaciones[clave] = organizacion
    db.flush()

    fundacion = _usuario(db, "fundacion", "Fundación Mesa Común (demo)", UsuarioRol.FUNDACION, clave_hash)
    usuarios_comercio = {
        clave: _usuario(db, f"comercio-{clave}", f"Encargado {c.nombre}", UsuarioRol.COMERCIO, clave_hash,
                        comercio_id=c.id)
        for clave, c in comercios.items()
    }
    usuarios_organizacion = {
        clave: _usuario(db, f"organizacion-{clave.lower()}", f"Receptor {o.nombre}", UsuarioRol.ORGANIZACION,
                        clave_hash, organizacion_id=o.id)
        for clave, o in organizaciones.items()
    }
    for clave, (id_, nombre, transporte, disponibilidad) in VOLUNTARIOS.items():
        _usuario(db, f"voluntario-{clave.lower()}", nombre, UsuarioRol.VOLUNTARIO, clave_hash, id=id_)
        if db.get(Voluntario, id_) is None:
            db.add(Voluntario(usuario_id=id_, medio_transporte=transporte, disponibilidad=disponibilidad))
    db.flush()

    ahora = datetime.now(timezone.utc).replace(microsecond=0)
    for demo in RESCATES:
        rescate_id = uid(f"rescate:{demo.clave}")
        if db.get(Rescate, rescate_id) is not None:
            continue
        creado = ahora + timedelta(hours=demo.creado)
        limite = ahora + timedelta(hours=demo.hora_limite)
        registrado_por = usuarios_comercio[demo.comercio] if demo.por_comercio else fundacion
        organizacion = organizaciones[demo.organizacion] if demo.organizacion else None
        voluntario_id = VOLUNTARIOS[demo.voluntario][0] if demo.voluntario else None
        receptor = usuarios_organizacion[demo.organizacion] if demo.organizacion else None

        # Momentos de cada transición, siempre entre la creación y la hora límite.
        paso = (limite - creado) / 4 if limite > creado else timedelta(minutes=30)
        asignado_en = creado + paso
        recogido_en = creado + 2 * paso
        entregado_en = creado + 3 * paso

        rescate = Rescate(
            id=rescate_id,
            comercio_id=comercios[demo.comercio].id,
            alimento=demo.alimento,
            cantidad_aprox=demo.cantidad_aprox,
            lugar_recogida=comercios[demo.comercio].direccion,
            hora_limite=limite,
            observaciones="Dato de demostración",
            estado=demo.estado,
            registrado_por=registrado_por.id,
            creado_en=creado,
        )
        historial = [(None, RescateEstado.DISPONIBLE, registrado_por.id, creado, {"accion": "registro"})]

        if demo.organizacion and demo.estado != RescateEstado.DISPONIBLE:
            rescate.organizacion_id = organizacion.id
            rescate.voluntario_id = voluntario_id
            rescate.asignado_en = asignado_en
            rescate.asignado_por = fundacion.id
            historial.append((RescateEstado.DISPONIBLE, RescateEstado.ASIGNADO, fundacion.id, asignado_en,
                              {"organizacion_id": str(organizacion.id), "voluntario_id": str(voluntario_id)}))
        if demo.estado in (RescateEstado.RECOGIDO, RescateEstado.ENTREGADO):
            rescate.recogido_en = recogido_en
            historial.append((RescateEstado.ASIGNADO, RescateEstado.RECOGIDO, voluntario_id, recogido_en,
                              {"accion": "entrega_voluntario"}))
        if demo.estado == RescateEstado.ENTREGADO:
            cantidad, unidad, personas = demo.recibido
            rescate.entregado_en = entregado_en
            rescate.recibido_por = receptor.id
            rescate.cantidad_recibida = cantidad
            rescate.unidad_recibida = unidad
            rescate.es_medida = unidad == "kg"
            rescate.personas_beneficiadas = personas
            historial.append((RescateEstado.RECOGIDO, RescateEstado.ENTREGADO, receptor.id, entregado_en,
                              {"accion": "recepcion_confirmada_por_organizacion",
                               "cantidad_recibida": float(cantidad), "unidad_recibida": unidad,
                               "es_medida": unidad == "kg", "personas_beneficiadas": personas}))
        if demo.estado == RescateEstado.NO_COMPLETADO:
            rescate.motivo_no_completado = demo.motivo
            anterior = RescateEstado.ASIGNADO if demo.organizacion else RescateEstado.DISPONIBLE
            actor = registrado_por.id if demo.motivo == "Cancelado por el comercio" else fundacion.id
            historial.append((anterior, RescateEstado.NO_COMPLETADO, actor, asignado_en + paso,
                              {"motivo": demo.motivo}))

        db.add(rescate)
        db.flush()
        for anterior, nuevo, actor, momento, detalle in historial:
            db.add(RescateHistorial(rescate_id=rescate_id, estado_anterior=anterior, estado_nuevo=nuevo,
                                    cambiado_por=actor, cambiado_en=momento, detalle=detalle))
        creados["rescates"] += 1
    return creados


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--produccion", action="store_true",
                        help="Permite cargar los datos en una base con ENTORNO=produccion")
    args = parser.parse_args()

    if get_settings().es_produccion and not args.produccion:
        sys.exit("ENTORNO=produccion: agrega --produccion si de verdad quieres cargar los datos del Demo.")
    contrasena = os.getenv("SEED_DEMO_PASSWORD", "")
    if len(contrasena) < 10:
        sys.exit("Define SEED_DEMO_PASSWORD con al menos 10 caracteres.")

    with SessionLocal.begin() as db:
        creados = _cargar(db, contrasena)
    print(f"Datos del Demo cargados: {creados['rescates']} rescates nuevos "
          f"(de {len(RESCATES)}). Cuentas: demo-<rol>@{DOMINIO}.")


if __name__ == "__main__":
    main()
