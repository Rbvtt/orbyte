import os
from uuid import uuid4

from sqlalchemy import select, text

from app.database import SessionLocal
from app.models import Usuario, UsuarioRol
from app.security import hash_password


def main() -> None:
    seed_password = os.getenv("SEED_PASSWORD")
    if not seed_password:
        raise RuntimeError("SEED_PASSWORD es obligatoria para ejecutar el seed de desarrollo")

    print("AVISO: este script es solo para desarrollo; no debe ejecutarse en producción.")
    usuarios = (
        ("fundacion@example.com", UsuarioRol.FUNDACION),
        ("voluntario@example.com", UsuarioRol.VOLUNTARIO),
        ("organizacion@example.com", UsuarioRol.ORGANIZACION),
        ("comercio@example.com", UsuarioRol.COMERCIO),
    )

    with SessionLocal.begin() as db:
        for email, rol in usuarios:
            existente = db.scalar(select(Usuario).where(Usuario.email == email))
            if existente is not None:
                continue
            db.execute(
                text(
                    """
                    INSERT INTO usuarios (id, nombre, email, password_hash, rol, activo)
                    VALUES (:id, :nombre, :email, :password_hash, CAST(:rol AS usuario_rol), true)
                    """
                ),
                {
                    "id": uuid4(),
                    "nombre": rol.value.title(),
                    "email": email,
                    "password_hash": hash_password(seed_password),
                    "rol": rol.value,
                },
            )


if __name__ == "__main__":
    main()
