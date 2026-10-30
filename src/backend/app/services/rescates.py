import hashlib
import json
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import CurrentUser
from app.models import (
    Comercio,
    IdempotencyKey,
    Rescate,
    RescateEstado,
    RescateHistorial,
)
from app.schemas.rescates import RescateCreate


class FieldValidationError(ValueError):
    def __init__(self, field: str, message: str):
        super().__init__(message)
        self.field = field
        self.message = message


def asignar_rescate(
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
    asignacion_exitosa = result.scalar_one_or_none() is not None
    db.commit()
    return asignacion_exitosa


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
