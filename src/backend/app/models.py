from enum import Enum
from uuid import UUID

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import ENUM, UUID as PostgreSQLUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UsuarioRol(str, Enum):
    FUNDACION = "fundacion"
    VOLUNTARIO = "voluntario"
    ORGANIZACION = "organizacion"
    COMERCIO = "comercio"


class RescateEstado(str, Enum):
    DISPONIBLE = "disponible"
    ASIGNADO = "asignado"
    RECOGIDO = "recogido"
    ENTREGADO = "entregado"
    NO_COMPLETADO = "no_completado"


def postgres_enum(enum_class: type[Enum], name: str) -> ENUM:
    return ENUM(
        enum_class,
        name=name,
        create_type=False,
        values_callable=lambda values: [member.value for member in values],
    )


class OrganizacionReceptora(Base):
    __tablename__ = "organizaciones_receptoras"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    direccion: Mapped[str] = mapped_column(Text, nullable=False)
    capacidad_kg: Mapped[float | None] = mapped_column(Numeric(10, 2))
    refrigeracion: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    horario_recepcion: Mapped[str | None] = mapped_column(Text)
    puede_recoger: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    rol: Mapped[UsuarioRol] = mapped_column(postgres_enum(UsuarioRol, "usuario_rol"), nullable=False)
    organizacion_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("organizaciones_receptoras.id"),
    )
    comercio_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("comercios.id"),
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Comercio(Base):
    __tablename__ = "comercios"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    direccion: Mapped[str] = mapped_column(String, nullable=False)
    telefono: Mapped[str | None] = mapped_column(String)


class Voluntario(Base):
    __tablename__ = "voluntarios"

    usuario_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        primary_key=True,
    )
    medio_transporte: Mapped[str | None] = mapped_column(Text)
    disponibilidad: Mapped[str | None] = mapped_column(Text)


class Rescate(Base):
    __tablename__ = "rescates"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    comercio_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("comercios.id"), nullable=False
    )
    alimento: Mapped[str] = mapped_column(Text, nullable=False)
    cantidad_aprox: Mapped[str] = mapped_column(Text, nullable=False)
    lugar_recogida: Mapped[str] = mapped_column(Text, nullable=False)
    hora_limite: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    observaciones: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[RescateEstado] = mapped_column(
        postgres_enum(RescateEstado, "rescate_estado"),
        nullable=False,
        default=RescateEstado.DISPONIBLE,
    )
    registrado_por: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    organizacion_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("organizaciones_receptoras.id")
    )
    voluntario_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("voluntarios.usuario_id")
    )
    asignado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    asignado_por: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("usuarios.id")
    )
    recogido_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    entregado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recibido_por: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("usuarios.id")
    )
    cantidad_recibida: Mapped[float | None] = mapped_column(Numeric(10, 2))
    unidad_recibida: Mapped[str | None] = mapped_column(Text)
    es_medida: Mapped[bool | None] = mapped_column(Boolean)
    personas_beneficiadas: Mapped[int | None] = mapped_column(Integer)
    motivo_no_completado: Mapped[str | None] = mapped_column(Text)


class RescateHistorial(Base):
    __tablename__ = "rescate_historial"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    rescate_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("rescates.id", ondelete="CASCADE"),
        nullable=False,
    )
    estado_anterior: Mapped[RescateEstado | None] = mapped_column(
        postgres_enum(RescateEstado, "rescate_estado")
    )
    estado_nuevo: Mapped[RescateEstado] = mapped_column(
        postgres_enum(RescateEstado, "rescate_estado"), nullable=False
    )
    cambiado_por: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False
    )
    cambiado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    usuario_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), ForeignKey("usuarios.id"), primary_key=True
    )
    clave: Mapped[str] = mapped_column(String, primary_key=True)
    request_hash: Mapped[str] = mapped_column(String, nullable=False)
    rescate_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("rescates.id", ondelete="CASCADE"),
        nullable=False,
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
