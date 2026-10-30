from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
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
