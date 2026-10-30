from dataclasses import dataclass
from typing import Optional
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario, UsuarioRol
from app.security import decode_token


ROLES_VE_BENEFICIARIOS = ("fundacion", "organizacion")
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    sub: str
    rol: str
    usuario_id: Optional[UUID] = None
    comercio_id: Optional[UUID] = None


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autorizado",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if credentials is None:
        raise _unauthorized()

    try:
        payload = decode_token(credentials.credentials)
        sub = payload["sub"]
        if not isinstance(sub, str):
            raise ValueError
        user_id = UUID(sub)
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise _unauthorized() from None

    usuario = db.scalar(select(Usuario).where(Usuario.id == user_id))
    if usuario is None or not usuario.activo:
        raise _unauthorized()

    return CurrentUser(
        sub=sub,
        rol=usuario.rol.value,
        usuario_id=usuario.id,
        comercio_id=getattr(usuario, "comercio_id", None),
    )


def require_role(*roles: str):
    valid_roles = {role.value for role in UsuarioRol}
    if not roles:
        raise ValueError("require_role requiere al menos un rol")
    invalid_roles = set(roles) - valid_roles
    if invalid_roles:
        raise ValueError("Rol no válido")

    def role_dependency(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes",
            )
        return current_user

    return role_dependency
