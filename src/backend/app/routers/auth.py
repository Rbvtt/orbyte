from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import Comercio, Usuario
from app.security import create_access_token, hash_password, verify_password


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
_DUMMY_HASH = hash_password("dummy-password")


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip()


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UsuarioSesionOut(BaseModel):
    id: str
    nombre: str
    email: EmailStr
    rol: str
    comercio_id: str | None = None
    comercio_nombre: str | None = None


def _invalid_credentials() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    email = data.email.strip().lower()
    usuario = db.scalar(select(Usuario).where(func.lower(Usuario.email) == email))
    password_hash = usuario.password_hash if usuario is not None else _DUMMY_HASH
    password_valid = verify_password(data.password, password_hash)

    if usuario is None or not usuario.activo or not password_valid:
        raise _invalid_credentials()

    access_token = create_access_token(sub=str(usuario.id), rol=usuario.rol.value)
    return TokenOut(access_token=access_token)


@router.get("/me", response_model=UsuarioSesionOut)
def current_session(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UsuarioSesionOut:
    usuario = db.get(Usuario, current_user.usuario_id)
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autorizado",
        )
    comercio = db.get(Comercio, usuario.comercio_id) if usuario.comercio_id else None
    return UsuarioSesionOut(
        id=str(usuario.id),
        nombre=usuario.nombre,
        email=usuario.email,
        rol=usuario.rol.value,
        comercio_id=str(usuario.comercio_id) if usuario.comercio_id else None,
        comercio_nombre=comercio.nombre if comercio else None,
    )
