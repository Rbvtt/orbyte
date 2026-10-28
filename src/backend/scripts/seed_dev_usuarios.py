import os
from uuid import uuid4

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Comercio, Usuario, UsuarioRol
from app.security import hash_password


def main() -> None:
    seed_password = os.getenv("SEED_PASSWORD")
    if not seed_password:
        raise RuntimeError("SEED_PASSWORD es obligatoria para ejecutar el seed de desarrollo")

    print("AVISO: este script es solo para desarrollo; no debe ejecutarse en producción.")
    with SessionLocal.begin() as db:
        comercio = db.scalar(
            select(Comercio).where(Comercio.nombre == "Comercio de desarrollo")
        )
        if comercio is None:
            comercio = Comercio(
                nombre="Comercio de desarrollo",
                direccion="Dirección de desarrollo",
            )
            db.add(comercio)
            db.flush()

        usuarios = (
            ("fundacion@example.com", UsuarioRol.FUNDACION),
            ("voluntario@example.com", UsuarioRol.VOLUNTARIO),
            ("organizacion@example.com", UsuarioRol.ORGANIZACION),
            ("comercio@example.com", UsuarioRol.COMERCIO),
        )
        for email, rol in usuarios:
            existente = db.scalar(select(Usuario).where(Usuario.email == email))
            if existente is not None:
                if rol is UsuarioRol.COMERCIO and existente.comercio_id is None:
                    existente.comercio_id = comercio.id
                continue
            db.add(
                Usuario(
                    id=uuid4(),
                    nombre=rol.value.title(),
                    email=email,
                    password_hash=hash_password(seed_password),
                    rol=rol,
                    comercio_id=comercio.id if rol is UsuarioRol.COMERCIO else None,
                    activo=True,
                )
            )


if __name__ == "__main__":
    main()
