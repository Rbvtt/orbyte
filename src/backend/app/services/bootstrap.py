import logging
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import CONTRASENA_ADMIN_DESARROLLO, get_settings
from app.models import Usuario, UsuarioEstado, UsuarioRol
from app.security import hash_password

logger = logging.getLogger(__name__)


def ensure_seed_admin(db: Session) -> None:
    settings = get_settings()
    email = settings.default_admin_email.strip().lower()
    if not email:
        return
    usuario = db.scalar(select(Usuario).where(Usuario.email.ilike(email)))
    if usuario is not None:
        return

    contrasena = settings.default_admin_password
    if settings.es_produccion and contrasena.strip() in ("", CONTRASENA_ADMIN_DESARROLLO):
        logger.error("No se creó el administrador inicial: define DEFAULT_ADMIN_PASSWORD con un valor propio.")
        return

    db.add(
        Usuario(
            id=uuid4(),
            nombre="Marcela",
            email=email,
            password_hash=hash_password(contrasena),
            rol=UsuarioRol.ADMINISTRADOR,
            estado=UsuarioEstado.APROBADO,
            activo=True,
        )
    )
    db.commit()
