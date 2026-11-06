from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user, require_role
from app.models import (
    Comercio,
    OrganizacionReceptora,
    Usuario,
    UsuarioEstado,
    UsuarioRol,
    Voluntario,
)
from app.security import create_access_token, hash_password, verify_password


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
admin_router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
fundacion_router = APIRouter(prefix="/api/v1/fundacion", tags=["fundacion"])
_DUMMY_HASH = hash_password("dummy-password")


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip()


class RegistroUsuarioIn(BaseModel):
    model_config = ConfigDict(extra="allow")

    nombre: str
    email: EmailStr
    password: str = Field(min_length=8)
    rol: UsuarioRol
    direccion: str | None = None
    telefono: str | None = None
    medio_transporte: str | None = None
    disponibilidad: str | None = None

    @field_validator("nombre", "direccion", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        cleaned = value.strip()
        return cleaned or None


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


class UsuarioAdminOut(BaseModel):
    id: str
    nombre: str
    email: EmailStr
    rol: str
    estado: str
    activo: bool
    comercio_id: str | None = None
    organizacion_id: str | None = None
    motivo_rechazo: str | None = None


class ComercioGestionOut(BaseModel):
    id: str
    nombre: str
    email: EmailStr
    estado: str
    activo: bool
    direccion: str
    telefono: str | None = None
    motivo_rechazo: str | None = None


class RechazoCuentaIn(BaseModel):
    motivo: str | None = None


def _invalid_credentials() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _estado_rechazado(usuario: Usuario) -> HTTPException:
    detalle = "Tu cuenta fue rechazada"
    if usuario.motivo_rechazo:
        detalle = f"Tu cuenta fue rechazada. Motivo: {usuario.motivo_rechazo}"
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detalle)


def _estado_bloqueado(usuario: Usuario) -> HTTPException:
    estado = getattr(usuario, "estado", UsuarioEstado.APROBADO)
    if estado == UsuarioEstado.PENDIENTE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta está pendiente de aprobación",
        )
    if estado == UsuarioEstado.RECHAZADO:
        raise _estado_rechazado(usuario)
    if estado == UsuarioEstado.INACTIVO:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta fue desactivada",
        )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Tu cuenta no está activa",
    )


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    email = data.email.strip().lower()
    usuario = db.scalar(select(Usuario).where(func.lower(Usuario.email) == email))
    password_hash = usuario.password_hash if usuario is not None else _DUMMY_HASH
    password_valid = verify_password(data.password, password_hash)

    if usuario is None or not getattr(usuario, "activo", False) or not password_valid:
        raise _invalid_credentials()
    if getattr(usuario, "estado", UsuarioEstado.APROBADO) != UsuarioEstado.APROBADO:
        raise _estado_bloqueado(usuario)

    access_token = create_access_token(sub=str(usuario.id), rol=usuario.rol.value)
    return TokenOut(access_token=access_token)


@router.post("/register")
def register_user(data: RegistroUsuarioIn, db: Session = Depends(get_db)) -> dict[str, str | bool]:
    if data.rol == UsuarioRol.ADMINISTRADOR:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El rol administrador no está disponible en el registro público",
        )

    email = data.email.strip().lower()
    if db.scalar(select(Usuario).where(func.lower(Usuario.email) == email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ese correo ya está registrado",
        )

    estado = UsuarioEstado.APROBADO if data.rol in {UsuarioRol.VOLUNTARIO, UsuarioRol.ORGANIZACION} else UsuarioEstado.PENDIENTE

    if data.rol == UsuarioRol.COMERCIO:
        if not data.direccion:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La dirección del comercio es obligatoria",
            )
        comercio = Comercio(nombre=data.nombre, direccion=data.direccion, telefono=data.telefono)
        db.add(comercio)
        db.flush()
        usuario = Usuario(
            id=uuid4(),
            nombre=data.nombre,
            email=email,
            password_hash=hash_password(data.password),
            rol=UsuarioRol.COMERCIO,
            comercio_id=comercio.id,
            estado=estado,
            activo=True,
        )
        db.add(usuario)
        db.flush()
        db.commit()
        return {"mensaje": "Registro completado", "aprobado": estado == UsuarioEstado.APROBADO}

    if data.rol == UsuarioRol.VOLUNTARIO:
        usuario = Usuario(
            id=uuid4(),
            nombre=data.nombre,
            email=email,
            password_hash=hash_password(data.password),
            rol=UsuarioRol.VOLUNTARIO,
            estado=estado,
            activo=True,
        )
        db.add(usuario)
        db.flush()
        db.add(
            Voluntario(
                usuario_id=usuario.id,
                medio_transporte=data.medio_transporte,
                disponibilidad=data.disponibilidad,
            )
        )
        db.commit()
        return {"mensaje": "Registro completado", "aprobado": True}

    if data.rol == UsuarioRol.ORGANIZACION:
        if not data.direccion:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La dirección de la organización es obligatoria",
            )
        organizacion = OrganizacionReceptora(
            nombre=data.nombre,
            direccion=data.direccion,
            capacidad_kg=None,
            refrigeracion=False,
            horario_recepcion=None,
            puede_recoger=False,
        )
        db.add(organizacion)
        db.flush()
        usuario = Usuario(
            id=uuid4(),
            nombre=data.nombre,
            email=email,
            password_hash=hash_password(data.password),
            rol=UsuarioRol.ORGANIZACION,
            organizacion_id=organizacion.id,
            estado=estado,
            activo=True,
        )
        db.add(usuario)
        db.commit()
        return {"mensaje": "Registro completado", "aprobado": True}

    if data.rol == UsuarioRol.FUNDACION:
        usuario = Usuario(
            id=uuid4(),
            nombre=data.nombre,
            email=email,
            password_hash=hash_password(data.password),
            rol=UsuarioRol.FUNDACION,
            estado=estado,
            activo=True,
        )
        db.add(usuario)
        db.commit()
        return {"mensaje": "Registro completado", "aprobado": False}

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rol no soportado")


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


@router.get("/admin/usuarios", response_model=list[UsuarioAdminOut])
def list_users(
    _current_user: CurrentUser = Depends(require_role("administrador")),
    db: Session = Depends(get_db),
    rol: str | None = None,
    estado: str | None = None,
) -> list[UsuarioAdminOut]:
    stmt = select(Usuario)
    if rol:
        stmt = stmt.where(Usuario.rol == UsuarioRol(rol))
    if estado:
        stmt = stmt.where(Usuario.estado == UsuarioEstado(estado))
    usuarios = db.scalars(stmt.order_by(Usuario.nombre)).all()
    return [
        UsuarioAdminOut(
            id=str(usuario.id),
            nombre=usuario.nombre,
            email=usuario.email,
            rol=usuario.rol.value,
            estado=usuario.estado.value,
            activo=usuario.activo,
            comercio_id=str(usuario.comercio_id) if usuario.comercio_id else None,
            organizacion_id=str(usuario.organizacion_id) if usuario.organizacion_id else None,
            motivo_rechazo=usuario.motivo_rechazo,
        )
        for usuario in usuarios
    ]


@router.get("/admin/cuentas-pendientes", response_model=list[UsuarioAdminOut])
def list_pending_users(
    _current_user: CurrentUser = Depends(require_role("administrador")),
    db: Session = Depends(get_db),
) -> list[UsuarioAdminOut]:
    usuarios = db.scalars(
        select(Usuario)
        .where(Usuario.estado == UsuarioEstado.PENDIENTE)
        .where(Usuario.rol.in_((UsuarioRol.FUNDACION, UsuarioRol.COMERCIO)))
        .order_by(Usuario.nombre)
    ).all()
    return [
        UsuarioAdminOut(
            id=str(usuario.id),
            nombre=usuario.nombre,
            email=usuario.email,
            rol=usuario.rol.value,
            estado=usuario.estado.value,
            activo=usuario.activo,
            comercio_id=str(usuario.comercio_id) if usuario.comercio_id else None,
            organizacion_id=str(usuario.organizacion_id) if usuario.organizacion_id else None,
            motivo_rechazo=usuario.motivo_rechazo,
        )
        for usuario in usuarios
    ]


@admin_router.get("/usuarios", response_model=list[UsuarioAdminOut])
@admin_router.get("/users", response_model=list[UsuarioAdminOut])
def admin_list_users(
    _current_user: CurrentUser = Depends(require_role("administrador")),
    db: Session = Depends(get_db),
    rol: str | None = None,
    estado: str | None = None,
) -> list[UsuarioAdminOut]:
    return list_users(_current_user, db, rol, estado)


@admin_router.get("/cuentas-pendientes", response_model=list[UsuarioAdminOut])
def admin_list_pending_users(
    _current_user: CurrentUser = Depends(require_role("administrador")),
    db: Session = Depends(get_db),
) -> list[UsuarioAdminOut]:
    return list_pending_users(_current_user, db)


def _update_account_state(
    db: Session,
    usuario: Usuario,
    estado: UsuarioEstado,
    actor_id: UUID | None,
    motivo: str | None = None,
) -> Usuario:
    usuario.estado = estado
    usuario.estado_actualizado_por = actor_id
    usuario.estado_actualizado_en = datetime.now(timezone.utc)
    if estado == UsuarioEstado.RECHAZADO:
        usuario.motivo_rechazo = motivo
    else:
        usuario.motivo_rechazo = None
    usuario.activo = estado not in {UsuarioEstado.RECHAZADO, UsuarioEstado.INACTIVO}
    return usuario


def _validate_admin_managed_account(usuario: Usuario) -> None:
    if usuario.rol not in {UsuarioRol.FUNDACION, UsuarioRol.COMERCIO}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta no está dentro del alcance de administración.",
        )


def _validate_pending_approval(usuario: Usuario) -> None:
    _validate_admin_managed_account(usuario)
    if usuario.estado != UsuarioEstado.PENDIENTE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La cuenta ya no está pendiente de aprobación.",
        )


def _validate_comercio(usuario: Usuario) -> None:
    if usuario.rol != UsuarioRol.COMERCIO:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La fundación solo puede gestionar cuentas de comercios.",
        )


@fundacion_router.get("/comercios", response_model=list[ComercioGestionOut])
def foundation_list_commerces(
    _current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> list[ComercioGestionOut]:
    rows = db.execute(
        select(Usuario, Comercio)
        .join(Comercio, Comercio.id == Usuario.comercio_id)
        .where(Usuario.rol == UsuarioRol.COMERCIO)
        .order_by(Usuario.nombre)
    ).all()
    return [
        ComercioGestionOut(
            id=str(usuario.id),
            nombre=comercio.nombre,
            email=usuario.email,
            estado=usuario.estado.value,
            activo=usuario.activo,
            direccion=comercio.direccion,
            telefono=comercio.telefono,
            motivo_rechazo=usuario.motivo_rechazo,
        )
        for usuario, comercio in rows
    ]


@fundacion_router.post("/comercios/{usuario_id}/aprobar")
def foundation_approve_commerce(
    usuario_id: UUID,
    current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comercio no encontrado")
    _validate_comercio(usuario)
    if usuario.estado not in {UsuarioEstado.PENDIENTE, UsuarioEstado.RECHAZADO}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El comercio ya no está pendiente de aprobación.")
    if current_user.usuario_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
    _update_account_state(db, usuario, UsuarioEstado.APROBADO, current_user.usuario_id)
    db.commit()
    return {"mensaje": "Comercio aprobado", "estado": UsuarioEstado.APROBADO.value}


@fundacion_router.post("/comercios/{usuario_id}/desactivar")
def foundation_deactivate_commerce(
    usuario_id: UUID,
    current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comercio no encontrado")
    _validate_comercio(usuario)
    if usuario.estado != UsuarioEstado.APROBADO:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se pueden desactivar comercios aprobados.")
    if current_user.usuario_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
    _update_account_state(db, usuario, UsuarioEstado.INACTIVO, current_user.usuario_id)
    db.commit()
    return {"mensaje": "Comercio desactivado", "estado": UsuarioEstado.INACTIVO.value}


@fundacion_router.post("/comercios/{usuario_id}/reactivar")
def foundation_reactivate_commerce(
    usuario_id: UUID,
    current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comercio no encontrado")
    _validate_comercio(usuario)
    if usuario.estado != UsuarioEstado.INACTIVO:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se pueden reactivar comercios desactivados.")
    if current_user.usuario_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
    _update_account_state(db, usuario, UsuarioEstado.APROBADO, current_user.usuario_id)
    db.commit()
    return {"mensaje": "Comercio reactivado", "estado": UsuarioEstado.APROBADO.value}


@router.post("/admin/usuarios/{usuario_id}/aprobar")
def approve_user(
    usuario_id: str,
    current_user: CurrentUser = Depends(require_role("administrador")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    _validate_pending_approval(usuario)
    if current_user.usuario_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
    _update_account_state(db, usuario, UsuarioEstado.APROBADO, current_user.usuario_id)
    db.commit()
    return {"mensaje": "Usuario aprobado", "estado": UsuarioEstado.APROBADO.value}


@router.post("/admin/usuarios/{usuario_id}/rechazar")
def reject_user(
    usuario_id: str,
    data: RechazoCuentaIn | None = None,
    current_user: CurrentUser = Depends(require_role("administrador")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    _validate_pending_approval(usuario)
    if current_user.usuario_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
    if current_user.usuario_id == usuario.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Un administrador no puede rechazarse a sí mismo")
    motivo = data.motivo if data is not None else None
    _update_account_state(db, usuario, UsuarioEstado.RECHAZADO, current_user.usuario_id, motivo)
    db.commit()
    return {"mensaje": "Usuario rechazado", "estado": UsuarioEstado.RECHAZADO.value}


@router.post("/admin/usuarios/{usuario_id}/desactivar")
def deactivate_user(
    usuario_id: str,
    current_user: CurrentUser = Depends(require_role("administrador")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    _validate_admin_managed_account(usuario)
    if current_user.usuario_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
    if current_user.usuario_id == usuario.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Un administrador no puede desactivarse a sí mismo")
    _update_account_state(db, usuario, UsuarioEstado.INACTIVO, current_user.usuario_id)
    db.commit()
    return {"mensaje": "Usuario desactivado", "estado": UsuarioEstado.INACTIVO.value}


@router.post("/admin/usuarios/{usuario_id}/reactivar")
def reactivate_user(
    usuario_id: str,
    current_user: CurrentUser = Depends(require_role("administrador")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    _validate_admin_managed_account(usuario)
    if current_user.usuario_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
    _update_account_state(db, usuario, UsuarioEstado.APROBADO, current_user.usuario_id)
    db.commit()
    return {"mensaje": "Usuario reactivado", "estado": UsuarioEstado.APROBADO.value}


@admin_router.post("/usuarios/{usuario_id}/aprobar")
def admin_approve_user(usuario_id: str, current_user: CurrentUser = Depends(require_role("administrador")), db: Session = Depends(get_db)) -> dict[str, str]:
    return approve_user(usuario_id, current_user, db)


@admin_router.post("/usuarios/{usuario_id}/rechazar")
def admin_reject_user(usuario_id: str, data: RechazoCuentaIn | None = None, current_user: CurrentUser = Depends(require_role("administrador")), db: Session = Depends(get_db)) -> dict[str, str]:
    return reject_user(usuario_id, data, current_user, db)


@admin_router.post("/usuarios/{usuario_id}/desactivar")
def admin_deactivate_user(usuario_id: str, current_user: CurrentUser = Depends(require_role("administrador")), db: Session = Depends(get_db)) -> dict[str, str]:
    return deactivate_user(usuario_id, current_user, db)


@admin_router.post("/usuarios/{usuario_id}/reactivar")
def admin_reactivate_user(usuario_id: str, current_user: CurrentUser = Depends(require_role("administrador")), db: Session = Depends(get_db)) -> dict[str, str]:
    return reactivate_user(usuario_id, current_user, db)
