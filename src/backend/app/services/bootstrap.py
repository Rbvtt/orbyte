from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Usuario, UsuarioEstado, UsuarioRol
from app.security import hash_password


def ensure_seed_admin(db: Session) -> None:
    settings = get_settings()
    email = settings.default_admin_email.strip().lower()
    if not email:
        return
    usuario = db.scalar(select(Usuario).where(Usuario.email.ilike(email)))
    if usuario is not None:
        return

    db.add(
        Usuario(
            id=uuid4(),
            nombre="Marcela",
            email=email,
            password_hash=hash_password(settings.default_admin_password),
            rol=UsuarioRol.ADMINISTRADOR,
            estado=UsuarioEstado.APROBADO,
            activo=True,
        )
    )
    db.commit()
