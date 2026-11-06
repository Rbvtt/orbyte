"""Carga idempotente de catálogo y 15 rescates ficticios para la Demo (#26, #36).

Uso solo contra una base local/de pruebas ya migrada. Requiere SEED_PASSWORD y
ALLOW_DEMO_SEED=1. Nunca apunta el seed de demostración a producción.
"""

from __future__ import annotations

import csv
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID, uuid5, NAMESPACE_URL

from sqlalchemy import select
from sqlalchemy.engine import make_url

from app.config import get_settings
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
from app.security import hash_password

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "docs" / "datos" / "cmp02"
NOW = datetime.now(timezone.utc).replace(microsecond=0)

USERS = {
    "fundacion": (UUID("00000000-0000-4000-8000-000000000101"), "Fundación Demo", "fundacion-demo@example.invalid", UsuarioRol.FUNDACION),
    "organizacion_a": (UUID("00000000-0000-4000-8000-000000000211"), "Organización Demo A", "organizacion-a@example.invalid", UsuarioRol.ORGANIZACION),
    "organizacion_b": (UUID("00000000-0000-4000-8000-000000000212"), "Organización Demo B", "organizacion-b@example.invalid", UsuarioRol.ORGANIZACION),
    "comercio_a": (UUID("00000000-0000-4000-8000-000000000401"), "Comercio Demo A", "comercio-a@example.invalid", UsuarioRol.COMERCIO),
    "comercio_b": (UUID("00000000-0000-4000-8000-000000000402"), "Comercio Demo B", "comercio-b@example.invalid", UsuarioRol.COMERCIO),
}

ALIMENTOS = (
    ("Frutas", "12 kg", "Canastilla de fruta mixta"),
    ("Pan", "30 unidades", "Pan del día"),
    ("Verduras", "8 kg", "Verdura fresca variada"),
)


def identifier(value: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"orbyte-demo:{value}")


def add_catalog(db, password: str) -> tuple[list[UUID], list[UUID]]:
    with (DATA / "organizaciones.csv").open(encoding="utf-8", newline="") as file:
        org_rows = list(csv.DictReader(file))
    with (DATA / "voluntarios.csv").open(encoding="utf-8", newline="") as file:
        volunteer_rows = list(csv.DictReader(file))

    org_ids = [UUID(row["id"]) for row in org_rows]
    volunteer_ids = [UUID(row["usuario_id"]) for row in volunteer_rows]
    commerce_ids = [identifier("comercio-a"), identifier("comercio-b")]

    for row in org_rows:
        item_id = UUID(row["id"])
        if db.get(OrganizacionReceptora, item_id) is None:
            db.add(OrganizacionReceptora(
                id=item_id,
                nombre=row["nombre"],
                direccion=row["direccion"],
                capacidad_kg=row["capacidad_kg"],
                refrigeracion=row["refrigeracion"].lower() == "true",
                horario_recepcion=row["horario_recepcion"],
                puede_recoger=row["puede_recoger"].lower() == "true",
            ))
    db.flush()

    for comercio_id, name, address in zip(commerce_ids, ("Comercio Demo A", "Comercio Demo B"), ("Punto ficticio D", "Punto ficticio E")):
        if db.get(Comercio, comercio_id) is None:
            db.add(Comercio(id=comercio_id, nombre=name, direccion=address))
    db.flush()

    password_hash = hash_password(password)
    account_rows = list(USERS.values())
    account_rows += [
        (UUID(row["usuario_id"]), row["nombre"], row["email"], UsuarioRol.VOLUNTARIO)
        for row in volunteer_rows
    ]
    for user_id, name, email, role in account_rows:
        if db.get(Usuario, user_id) is not None:
            continue
        org_id = org_ids[0] if role == UsuarioRol.ORGANIZACION and user_id == USERS["organizacion_a"][0] else None
        if role == UsuarioRol.ORGANIZACION and user_id == USERS["organizacion_b"][0]:
            org_id = org_ids[1]
        commerce_id = commerce_ids[0] if user_id == USERS["comercio_a"][0] else None
        if user_id == USERS["comercio_b"][0]:
            commerce_id = commerce_ids[1]
        db.add(Usuario(
            id=user_id,
            nombre=name,
            email=email,
            password_hash=password_hash,
            rol=role,
            organizacion_id=org_id,
            comercio_id=commerce_id,
            activo=True,
        ))
    db.flush()

    for row in volunteer_rows:
        user_id = UUID(row["usuario_id"])
        if db.get(Voluntario, user_id) is None:
            db.add(Voluntario(
                usuario_id=user_id,
                medio_transporte=row["medio_transporte"],
                disponibilidad=row["disponibilidad"],
            ))
    db.flush()
    return org_ids, volunteer_ids


def add_rescues(db, org_ids: list[UUID], volunteer_ids: list[UUID]) -> int:
    foundation_id = USERS["fundacion"][0]
    commerce_ids = [identifier("comercio-a"), identifier("comercio-b")]
    account_org_ids = [USERS["organizacion_a"][0], USERS["organizacion_b"][0]]
    inserted = 0

    # Tres ejemplos por estado. Delivered dates span two different calendar months.
    states = [RescateEstado.DISPONIBLE, RescateEstado.ASIGNADO, RescateEstado.RECOGIDO,
              RescateEstado.ENTREGADO, RescateEstado.NO_COMPLETADO]
    for state_index, state in enumerate(states):
        for sample in range(3):
            sequence = state_index * 3 + sample + 1
            rescue_id = identifier(f"rescate-{sequence:02}")
            if db.get(Rescate, rescue_id) is not None:
                continue

            commerce_index = sample % 2
            volunteer_id = volunteer_ids[sample % len(volunteer_ids)]
            org_index = sample % 2
            comercio_id = commerce_ids[commerce_index]
            registered_by = USERS["comercio_a"][0] if commerce_index == 0 else USERS["comercio_b"][0]
            received_by = account_org_ids[org_index]
            delivered_age = (40, 8, 6)[sample]
            age_days = (
                delivered_age
                if state == RescateEstado.ENTREGADO
                else 3 * sequence if state == RescateEstado.NO_COMPLETADO else 0
            )
            created_at = NOW - timedelta(days=age_days)
            assigned_at = created_at + timedelta(minutes=20)
            collected_at = assigned_at + timedelta(hours=1)
            delivered_at = collected_at + timedelta(hours=2)
            deadline = created_at + timedelta(hours=6)
            rescue = Rescate(
                id=rescue_id,
                comercio_id=comercio_id,
                alimento=ALIMENTOS[sample][0],
                cantidad_aprox=ALIMENTOS[sample][1],
                lugar_recogida=f"Punto ficticio {chr(65 + commerce_index)}",
                hora_limite=deadline,
                observaciones=ALIMENTOS[sample][2],
                estado=state,
                registrado_por=registered_by,
                creado_en=created_at,
                organizacion_id=org_ids[org_index] if state in (
                    RescateEstado.ASIGNADO,
                    RescateEstado.RECOGIDO,
                    RescateEstado.ENTREGADO,
                ) else None,
                voluntario_id=volunteer_id if state in (RescateEstado.ASIGNADO, RescateEstado.RECOGIDO, RescateEstado.ENTREGADO) else None,
                asignado_en=assigned_at if state in (RescateEstado.ASIGNADO, RescateEstado.RECOGIDO, RescateEstado.ENTREGADO) else None,
                asignado_por=foundation_id if state in (RescateEstado.ASIGNADO, RescateEstado.RECOGIDO, RescateEstado.ENTREGADO) else None,
                recogido_en=collected_at if state in (RescateEstado.RECOGIDO, RescateEstado.ENTREGADO) else None,
                entregado_en=delivered_at if state == RescateEstado.ENTREGADO else None,
                recibido_por=received_by if state == RescateEstado.ENTREGADO else None,
                cantidad_recibida=7 + sample if state == RescateEstado.ENTREGADO else None,
                unidad_recibida="kg" if state == RescateEstado.ENTREGADO else None,
                es_medida=True if state == RescateEstado.ENTREGADO else None,
                personas_beneficiadas=8 + sample if state == RescateEstado.ENTREGADO else None,
                motivo_no_completado="El comercio no alcanzó a entregar el alimento." if state == RescateEstado.NO_COMPLETADO else None,
            )
            db.add(rescue)
            db.flush()

            history = [(None, RescateEstado.DISPONIBLE, created_at, registered_by)]
            if state in (RescateEstado.ASIGNADO, RescateEstado.RECOGIDO, RescateEstado.ENTREGADO):
                history.append((RescateEstado.DISPONIBLE, RescateEstado.ASIGNADO, assigned_at, foundation_id))
            if state in (RescateEstado.RECOGIDO, RescateEstado.ENTREGADO):
                history.append((RescateEstado.ASIGNADO, RescateEstado.RECOGIDO, collected_at, volunteer_id))
            if state == RescateEstado.ENTREGADO:
                history.append((RescateEstado.RECOGIDO, RescateEstado.ENTREGADO, delivered_at, received_by))
            if state == RescateEstado.NO_COMPLETADO:
                history.append((RescateEstado.DISPONIBLE, RescateEstado.NO_COMPLETADO, assigned_at, foundation_id))
            db.add_all([
                RescateHistorial(
                    rescate_id=rescue_id,
                    estado_anterior=previous,
                    estado_nuevo=current,
                    cambiado_por=actor,
                    cambiado_en=occurred_at,
                )
                for previous, current, occurred_at, actor in history
            ])
            inserted += 1
    return inserted


def main() -> None:
    if os.getenv("ALLOW_DEMO_SEED") != "1":
        raise RuntimeError("Seed bloqueado: revisa la base y define ALLOW_DEMO_SEED=1 solo en local/QA.")
    if os.getenv("RENDER") or os.getenv("APP_ENV", "").lower() in {"prod", "production"}:
        raise RuntimeError("Seed bloqueado: no se ejecuta en un entorno de producción.")
    database_url = get_settings().sqlalchemy_database_url
    if not database_url:
        raise RuntimeError("DATABASE_URL es obligatoria y debe apuntar a PostgreSQL local.")
    url = make_url(database_url)
    if url.get_backend_name() != "postgresql" or url.host not in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError("Seed bloqueado: DATABASE_URL debe usar PostgreSQL local/QA en localhost.")
    password = os.getenv("SEED_PASSWORD")
    if not password:
        raise RuntimeError("SEED_PASSWORD es obligatoria para crear cuentas demo con hashes reales.")

    from app.database import SessionLocal

    with SessionLocal.begin() as db:
        org_ids, volunteer_ids = add_catalog(db, password)
        inserted = add_rescues(db, org_ids, volunteer_ids)
    print(f"Seed demo idempotente listo: 3 organizaciones, 3 voluntarios, 15 rescates; nuevos: {inserted}.")


if __name__ == "__main__":
    main()
