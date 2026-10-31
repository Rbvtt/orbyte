import hashlib
import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased
from sqlalchemy.orm import Session

from app.deps import CurrentUser
from app.models import (
    Comercio,
    IdempotencyKey,
    OrganizacionReceptora,
    Rescate,
    RescateEstado,
    RescateHistorial,
    Usuario,
    UsuarioRol,
    Voluntario,
)
from app.schemas.rescates import RescateCreate


class FieldValidationError(ValueError):
    def __init__(self, field: str, message: str):
        super().__init__(message)
        self.field = field
        self.message = message


class RescateNoEncontrado(LookupError):
    pass


class RecursoAsignacionNoEncontrado(LookupError):
    def __init__(self, recurso: str):
        super().__init__(recurso)
        self.recurso = recurso


class ConflictoAsignacion(RuntimeError):
    def __init__(self, voluntario_nombre: str | None):
        super().__init__()
        self.voluntario_nombre = voluntario_nombre


def _ejecutar_asignacion(
    db: Session,
    rescate_id: UUID,
    voluntario_id: UUID,
    organizacion_id: UUID,
    asignado_por: UUID,
) -> bool:
    result = db.execute(
        text(
            """
            UPDATE rescates
            SET voluntario_id = :voluntario_id,
                organizacion_id = :organizacion_id,
                estado = 'asignado',
                asignado_en = now(),
                asignado_por = :asignado_por
            WHERE id = :rescate_id
              AND estado = 'disponible'
              AND voluntario_id IS NULL
              AND hora_limite > now()
            RETURNING id
            """
        ),
        {
            "rescate_id": rescate_id,
            "voluntario_id": voluntario_id,
            "organizacion_id": organizacion_id,
            "asignado_por": asignado_por,
        },
    )
    return result.scalar_one_or_none() is not None


def asignar_rescate(
    db: Session,
    rescate_id: UUID,
    voluntario_id: UUID,
    organizacion_id: UUID,
    asignado_por: UUID,
) -> bool:
    asignacion_exitosa = _ejecutar_asignacion(
        db, rescate_id, voluntario_id, organizacion_id, asignado_por
    )
    db.commit()
    return asignacion_exitosa


def asignar_rescate_con_historial(
    db: Session,
    rescate_id: UUID,
    voluntario_id: UUID,
    organizacion_id: UUID,
    asignado_por: UUID,
) -> Rescate:
    if db.get(Rescate, rescate_id) is None:
        raise RescateNoEncontrado
    if db.get(OrganizacionReceptora, organizacion_id) is None:
        raise RecursoAsignacionNoEncontrado("organizacion_id")
    voluntario = db.scalar(
        select(Usuario).join(Voluntario, Voluntario.usuario_id == Usuario.id).where(
            Usuario.id == voluntario_id,
            Usuario.rol == UsuarioRol.VOLUNTARIO,
            Usuario.activo.is_(True),
        )
    )
    if voluntario is None:
        raise RecursoAsignacionNoEncontrado("voluntario_id")

    try:
        if not _ejecutar_asignacion(
            db, rescate_id, voluntario_id, organizacion_id, asignado_por
        ):
            actual = db.execute(
                select(Rescate, Usuario.nombre)
                .outerjoin(Usuario, Usuario.id == Rescate.voluntario_id)
                .where(Rescate.id == rescate_id)
            ).one()
            raise ConflictoAsignacion(actual.nombre)

        db.add(
            RescateHistorial(
                rescate_id=rescate_id,
                estado_anterior=RescateEstado.DISPONIBLE,
                estado_nuevo=RescateEstado.ASIGNADO,
                cambiado_por=asignado_por,
            )
        )
        db.commit()
        rescate = db.get(Rescate, rescate_id)
        if rescate is None:
            raise RuntimeError("La asignación no pudo recuperar el rescate")
        return rescate
    except Exception:
        db.rollback()
        raise


def listar_rescates_activos(db: Session) -> list[dict]:
    organizacion = aliased(OrganizacionReceptora)
    voluntario = aliased(Usuario)
    rows = db.execute(
        select(
            Rescate,
            Comercio.nombre,
            organizacion.nombre,
            voluntario.nombre,
        )
        .join(Comercio, Comercio.id == Rescate.comercio_id)
        .outerjoin(organizacion, organizacion.id == Rescate.organizacion_id)
        .outerjoin(voluntario, voluntario.id == Rescate.voluntario_id)
        .where(
            Rescate.estado.in_(
                (
                    RescateEstado.DISPONIBLE,
                    RescateEstado.ASIGNADO,
                    RescateEstado.RECOGIDO,
                )
            )
        )
        .order_by(Rescate.hora_limite.asc())
    ).all()
    return [
        {
            "id": rescate.id,
            "estado": rescate.estado,
            "hora_limite": rescate.hora_limite,
            "comercio": comercio_nombre,
            "organizacion": organizacion_nombre,
            "voluntario": voluntario_nombre,
            "pendiente_asignar": (
                rescate.estado == RescateEstado.DISPONIBLE
                and rescate.hora_limite > datetime.now(timezone.utc)
            ),
        }
        for rescate, comercio_nombre, organizacion_nombre, voluntario_nombre in rows
    ]


def obtener_detalle_rescate(
    db: Session, rescate_id: UUID, usuario: CurrentUser
) -> dict | None:
    organizacion = aliased(OrganizacionReceptora)
    voluntario = aliased(Usuario)
    row = db.execute(
        select(
            Rescate,
            Comercio.nombre,
            organizacion.nombre,
            organizacion.direccion,
            voluntario.nombre,
            Usuario.organizacion_id,
            Usuario.comercio_id,
        )
        .join(Comercio, Comercio.id == Rescate.comercio_id)
        .outerjoin(organizacion, organizacion.id == Rescate.organizacion_id)
        .outerjoin(voluntario, voluntario.id == Rescate.voluntario_id)
        .join(Usuario, Usuario.id == usuario.usuario_id)
        .where(Rescate.id == rescate_id)
    ).one_or_none()
    if row is None:
        return None

    (
        rescate,
        comercio_nombre,
        organizacion_nombre,
        lugar_entrega,
        voluntario_nombre,
        usuario_organizacion_id,
        usuario_comercio_id,
    ) = row
    autorizado = usuario.rol == UsuarioRol.FUNDACION.value or (
        usuario.rol == UsuarioRol.VOLUNTARIO.value
        and rescate.voluntario_id == usuario.usuario_id
    ) or (
        usuario.rol == UsuarioRol.ORGANIZACION.value
        and rescate.organizacion_id == usuario_organizacion_id
    ) or (
        usuario.rol == UsuarioRol.COMERCIO.value
        and rescate.comercio_id == usuario_comercio_id
    )
    if not autorizado:
        return None

    detalle = {
        "id": rescate.id,
        "estado": rescate.estado,
        "hora_limite": rescate.hora_limite,
        "pendiente_asignar": rescate.estado == RescateEstado.DISPONIBLE,
        "comercio": comercio_nombre,
        "alimento": rescate.alimento,
        "cantidad_aprox": rescate.cantidad_aprox,
        "lugar_recogida": rescate.lugar_recogida,
        "lugar_entrega": lugar_entrega,
        "organizacion": organizacion_nombre,
        "voluntario": voluntario_nombre,
        "asignado_en": rescate.asignado_en,
        "asignado_por": rescate.asignado_por,
        "observaciones": rescate.observaciones,
    }
    if usuario.rol == UsuarioRol.FUNDACION.value:
        return detalle
    if usuario.rol == UsuarioRol.VOLUNTARIO.value:
        return {
            key: detalle[key]
            for key in (
                "id",
                "estado",
                "hora_limite",
                "pendiente_asignar",
                "cantidad_aprox",
                "lugar_recogida",
                "lugar_entrega",
                "organizacion",
                "voluntario",
                "asignado_en",
            )
        }
    return {
        key: detalle[key]
        for key in (
            "id",
            "estado",
            "pendiente_asignar",
            "comercio",
            "organizacion",
            "voluntario",
            "asignado_en",
        )
    }


def _request_hash(datos: RescateCreate) -> str:
    canonical = json.dumps(
        datos.model_dump(mode="json"),
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _existing_idempotent_rescate(
    db: Session, usuario_id: UUID, clave: str, request_hash: str
) -> Rescate | None:
    existing_key = db.scalar(
        select(IdempotencyKey).where(
            IdempotencyKey.usuario_id == usuario_id,
            IdempotencyKey.clave == clave,
        )
    )
    if existing_key is None:
        return None
    if existing_key.request_hash != request_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La clave Idempotency-Key ya fue usada con otro contenido",
        )
    return db.get(Rescate, existing_key.rescate_id)


def crear_rescate(
    db: Session,
    usuario: CurrentUser,
    datos: RescateCreate,
    idempotency_key: str | None,
) -> tuple[Rescate, bool]:
    if usuario.usuario_id is None:
        raise RuntimeError("El usuario autenticado no tiene un identificador")

    if usuario.rol == "comercio":
        if usuario.comercio_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu usuario no tiene un comercio asociado",
            )
        if datos.comercio_id != usuario.comercio_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo puedes registrar rescates para tu comercio",
            )

    if idempotency_key is not None and not 1 <= len(idempotency_key) <= 255:
        raise FieldValidationError(
            "Idempotency-Key",
            "Idempotency-Key debe tener entre 1 y 255 caracteres",
        )

    request_hash = _request_hash(datos)
    if idempotency_key is not None:
        replay = _existing_idempotent_rescate(
            db, usuario.usuario_id, idempotency_key, request_hash
        )
        if replay is not None:
            return replay, True

    if db.get(Comercio, datos.comercio_id) is None:
        raise FieldValidationError(
            "comercio_id",
            "El comercio indicado no existe",
        )

    rescate = Rescate(
        comercio_id=datos.comercio_id,
        alimento=datos.alimento,
        cantidad_aprox=datos.cantidad_aprox,
        lugar_recogida=datos.lugar_recogida,
        hora_limite=datos.hora_limite,
        observaciones=datos.observaciones,
        estado=RescateEstado.DISPONIBLE,
        registrado_por=usuario.usuario_id,
    )
    try:
        db.add(rescate)
        db.flush()
        db.add(
            RescateHistorial(
                rescate_id=rescate.id,
                estado_anterior=None,
                estado_nuevo=RescateEstado.DISPONIBLE,
                cambiado_por=usuario.usuario_id,
            )
        )
        if idempotency_key is not None:
            db.add(
                IdempotencyKey(
                    usuario_id=usuario.usuario_id,
                    clave=idempotency_key,
                    request_hash=request_hash,
                    rescate_id=rescate.id,
                )
            )
        db.commit()
        db.refresh(rescate)
        return rescate, False
    except IntegrityError:
        db.rollback()
        if idempotency_key is not None:
            replay = _existing_idempotent_rescate(
                db, usuario.usuario_id, idempotency_key, request_hash
            )
            if replay is not None:
                return replay, True
        raise
    except Exception:
        db.rollback()
        raise
