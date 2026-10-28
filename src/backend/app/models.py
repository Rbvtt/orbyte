from enum import Enum
from uuid import UUID

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import ENUM, UUID as PostgreSQLUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UsuarioRol(str, Enum):
    FUNDACION = "fundacion"
    VOLUNTARIO = "voluntario"
    ORGANIZACION = "organizacion"
    COMERCIO = "comercio"


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    rol: Mapped[UsuarioRol] = mapped_column(
        ENUM(
            UsuarioRol,
            name="usuario_rol",
            create_type=False,
            values_callable=lambda enum_class: [member.value for member in enum_class],
        ),
        nullable=False,
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
