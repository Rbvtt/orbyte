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
    UsuarioEstado,
    UsuarioRol,
    Voluntario,
)
from app.schemas.rescates import RescateCreate, RescateUpdate
from app.services.transiciones import cambiar_estado


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


class RescateNoEditable(RuntimeError):
    pass


class ConflictoEstadoRescate(RuntimeError):
    pass


def marcar_rescate_no_completado(
    db: Session,
    rescate_id: UUID,
    actor_id: UUID,
    motivo: str,
) -> Rescate:
    rescate = db.scalar(
        select(Rescate).where(Rescate.id == rescate_id).with_for_update()
    )
    if rescate is None:
        db.rollback()
        raise RescateNoEncontrado

    if rescate.estado not in (RescateEstado.DISPONIBLE, RescateEstado.ASIGNADO):
        db.rollback()
        raise ConflictoEstadoRescate

    try:
        actualizado = cambiar_estado(
            db,
            rescate_id,
            rescate.estado,
            RescateEstado.NO_COMPLETADO,
            actor_id,
            cambios={"motivo_no_completado": motivo},
            detalle={"accion": "marcado_no_completado", "motivo": motivo},
        )
        if not actualizado:
            raise ConflictoEstadoRescate
        db.commit()
        resultado = db.get(Rescate, rescate_id)
        if resultado is None:
            raise RuntimeError("El rescate no completado no pudo recuperarse")
        return resultado
    except Exception:
        db.rollback()
        raise


class OrganizacionNoAutorizada(PermissionError):
    pass


def listar_historial_rescate(db: Session, rescate_id: UUID) -> list[dict]:
    """Devuelve el historial con el responsable y su rol en orden cronológico."""
    rescate_existe = db.scalar(select(Rescate.id).where(Rescate.id == rescate_id))
    if rescate_existe is None:
        raise RescateNoEncontrado

    filas = db.execute(
        select(
            RescateHistorial.id,
            RescateHistorial.estado_anterior,
            RescateHistorial.estado_nuevo,
            RescateHistorial.cambiado_en,
            RescateHistorial.cambiado_por,
            Usuario.nombre,
            Usuario.rol,
            RescateHistorial.detalle,
        )
        .join(Usuario, Usuario.id == RescateHistorial.cambiado_por)
        .where(RescateHistorial.rescate_id == rescate_id)
        .order_by(RescateHistorial.cambiado_en.asc(), RescateHistorial.id.asc())
    ).all()

    return [
        {
            "id": fila.id,
            "estado_anterior": fila.estado_anterior,
            "estado_nuevo": fila.estado_nuevo,
            "ocurrido_en": fila.cambiado_en,
            "actor_id": fila.cambiado_por,
            "actor_nombre": fila.nombre,
            "actor_rol": fila.rol.value,
            "detalle": fila.detalle,
        }
        for fila in filas
    ]


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
    rescate = db.scalar(
        select(Rescate).where(Rescate.id == rescate_id).with_for_update()
    )
    if rescate is None:
        db.rollback()
        raise RescateNoEncontrado
    organizacion_activa = db.scalar(
        select(OrganizacionReceptora.id)
        .join(Usuario, Usuario.organizacion_id == OrganizacionReceptora.id)
        .where(
            OrganizacionReceptora.id == organizacion_id,
            Usuario.rol == UsuarioRol.ORGANIZACION,
            Usuario.activo.is_(True),
            Usuario.estado == UsuarioEstado.APROBADO,
        )
    )
    if organizacion_activa is None:
        db.rollback()
        raise RecursoAsignacionNoEncontrado("organizacion_id")
    voluntario = db.scalar(
        select(Usuario).join(Voluntario, Voluntario.usuario_id == Usuario.id).where(
            Usuario.id == voluntario_id,
            Usuario.rol == UsuarioRol.VOLUNTARIO,
            Usuario.activo.is_(True),
            Usuario.estado == UsuarioEstado.APROBADO,
        )
    )
    if voluntario is None:
        db.rollback()
        raise RecursoAsignacionNoEncontrado("voluntario_id")

    try:
        if rescate.estado == RescateEstado.ASIGNADO and rescate.voluntario_id is not None:
            anterior_voluntario_id = rescate.voluntario_id
            actual = db.get(Usuario, anterior_voluntario_id)
            raise ConflictoAsignacion(actual.nombre if actual else None)

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


def listar_avisos_comercio(db: Session, comercio_id: UUID) -> list[Rescate]:
    return list(
        db.scalars(
            select(Rescate)
            .where(Rescate.comercio_id == comercio_id)
            .order_by(Rescate.creado_en.desc())
        ).all()
    )


def _obtener_aviso_comercio_editable(
    db: Session, rescate_id: UUID, comercio_id: UUID
) -> Rescate:
    rescate = db.scalar(
        select(Rescate)
        .where(Rescate.id == rescate_id, Rescate.comercio_id == comercio_id)
        .with_for_update()
    )
    if rescate is None:
        db.rollback()
        raise RescateNoEncontrado
    if (
        rescate.estado != RescateEstado.DISPONIBLE
        or rescate.hora_limite <= datetime.now(timezone.utc)
    ):
        db.rollback()
        raise RescateNoEditable
    return rescate


def editar_aviso_comercio(
    db: Session,
    rescate_id: UUID,
    comercio_id: UUID,
    actor_id: UUID,
    datos: RescateUpdate,
) -> Rescate:
    rescate = _obtener_aviso_comercio_editable(db, rescate_id, comercio_id)
    valores = datos.model_dump()
    cambios = {
        campo: {
            "anterior": getattr(rescate, campo).isoformat()
            if isinstance(getattr(rescate, campo), datetime)
            else getattr(rescate, campo),
            "nuevo": valor.isoformat() if isinstance(valor, datetime) else valor,
        }
        for campo, valor in valores.items()
        if getattr(rescate, campo) != valor
    }
    if not cambios:
        return rescate

    try:
        for campo, valor in valores.items():
            setattr(rescate, campo, valor)
        db.add(
            RescateHistorial(
                rescate_id=rescate.id,
                estado_anterior=RescateEstado.DISPONIBLE,
                estado_nuevo=RescateEstado.DISPONIBLE,
                cambiado_por=actor_id,
                detalle={"accion": "edicion_comercio", "cambios": cambios},
            )
        )
        db.commit()
        db.refresh(rescate)
        return rescate
    except Exception:
        db.rollback()
        raise


def cancelar_aviso_comercio(
    db: Session,
    rescate_id: UUID,
    comercio_id: UUID,
    actor_id: UUID,
) -> Rescate:
    _obtener_aviso_comercio_editable(db, rescate_id, comercio_id)
    motivo = "Cancelado por el comercio"
    try:
        actualizado = cambiar_estado(
            db,
            rescate_id,
            RescateEstado.DISPONIBLE,
            RescateEstado.NO_COMPLETADO,
            actor_id,
            cambios={"motivo_no_completado": motivo},
            condiciones={"comercio_id": comercio_id},
            detalle={"accion": "cancelacion_comercio", "motivo": motivo},
            exigir_hora_futura=True,
        )
        if not actualizado:
            raise RescateNoEditable
        db.commit()
        rescate = db.get(Rescate, rescate_id)
        if rescate is None:
            raise RuntimeError("El aviso cancelado no pudo recuperarse")
        return rescate
    except Exception:
        db.rollback()
        raise


def listar_rescates_activos(db: Session) -> list[dict]:
    organizacion = aliased(OrganizacionReceptora)
    voluntario = aliased(Usuario)
    creador = aliased(Usuario)
    rows = db.execute(
        select(
            Rescate,
            Comercio.nombre,
            organizacion.nombre,
            voluntario.nombre,
            creador.rol,
        )
        .join(Comercio, Comercio.id == Rescate.comercio_id)
        .join(creador, creador.id == Rescate.registrado_por)
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
            "origen_aviso": origen_aviso.value,
            "pendiente_asignar": (
                rescate.estado == RescateEstado.DISPONIBLE
                and rescate.hora_limite > datetime.now(timezone.utc)
            ),
        }
        for rescate, comercio_nombre, organizacion_nombre, voluntario_nombre, origen_aviso in rows
    ]


def listar_asignaciones_usuario(db: Session, usuario: CurrentUser) -> list[dict]:
    if usuario.usuario_id is None:
        return []

    if usuario.rol == UsuarioRol.VOLUNTARIO.value:
        filtro_asignacion = Rescate.voluntario_id == usuario.usuario_id
    elif usuario.rol == UsuarioRol.ORGANIZACION.value:
        organizacion_id = db.scalar(
            select(Usuario.organizacion_id).where(Usuario.id == usuario.usuario_id)
        )
        if organizacion_id is None:
            return []
        filtro_asignacion = Rescate.organizacion_id == organizacion_id
    else:
        return []

    organizacion = aliased(OrganizacionReceptora)
    voluntario = aliased(Usuario)
    creador = aliased(Usuario)
    fundacion = aliased(Usuario)
    rows = db.execute(
        select(
            Rescate,
            Comercio.nombre,
            organizacion.nombre,
            organizacion.direccion,
            voluntario.nombre,
            fundacion.nombre,
            creador.rol,
        )
        .join(Comercio, Comercio.id == Rescate.comercio_id)
        .join(creador, creador.id == Rescate.registrado_por)
        .outerjoin(organizacion, organizacion.id == Rescate.organizacion_id)
        .outerjoin(voluntario, voluntario.id == Rescate.voluntario_id)
        .outerjoin(fundacion, fundacion.id == Rescate.asignado_por)
        .where(
            filtro_asignacion,
            Rescate.estado.in_(
                (RescateEstado.ASIGNADO, RescateEstado.RECOGIDO, RescateEstado.ENTREGADO)
            ),
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
            "lugar_entrega": organizacion_direccion,
            "voluntario": voluntario_nombre,
            "fundacion": fundacion_nombre,
            "lugar_recogida": rescate.lugar_recogida,
            "cantidad_aprox": rescate.cantidad_aprox,
            "origen_aviso": origen_aviso.value,
            "pendiente_asignar": False,
            "estado_visual": (
                "por_recibir"
                if usuario.rol == UsuarioRol.ORGANIZACION.value
                and rescate.estado in (RescateEstado.ASIGNADO, RescateEstado.RECOGIDO)
                else "recibido"
                if usuario.rol == UsuarioRol.ORGANIZACION.value
                and rescate.estado == RescateEstado.ENTREGADO
                else "entregado_por_voluntario"
                if usuario.rol == UsuarioRol.VOLUNTARIO.value
                and rescate.estado == RescateEstado.RECOGIDO
                else rescate.estado.value
            ),
        }
        for (
            rescate,
            comercio_nombre,
            organizacion_nombre,
            organizacion_direccion,
            voluntario_nombre,
            fundacion_nombre,
            origen_aviso,
        ) in rows
    ]


def marcar_entregado_por_voluntario(
    db: Session, rescate_id: UUID, voluntario_id: UUID
) -> Rescate:
    asignado = db.scalar(
        select(Rescate.id).where(
            Rescate.id == rescate_id, Rescate.voluntario_id == voluntario_id
        )
    )
    if asignado is None:
        db.rollback()
        raise RescateNoEncontrado

    try:
        actualizado = cambiar_estado(
            db,
            rescate_id,
            RescateEstado.ASIGNADO,
            RescateEstado.RECOGIDO,
            voluntario_id,
            condiciones={"voluntario_id": voluntario_id},
            marca_tiempo="recogido_en",
            detalle={"accion": "entrega_confirmada_por_voluntario"},
        )
        if not actualizado:
            raise ConflictoEstadoRescate
        db.commit()
        rescate = db.get(Rescate, rescate_id)
        if rescate is None:
            raise RuntimeError("El rescate entregado no pudo recuperarse")
        return rescate
    except Exception:
        db.rollback()
        raise


def confirmar_recepcion_organizacion(
    db: Session,
    rescate_id: UUID,
    usuario_id: UUID,
    cantidad_recibida: float,
    unidad_recibida: str,
    es_medida: bool,
    personas_beneficiadas: int | None,
) -> Rescate:
    organizacion_id = db.scalar(
        select(Usuario.organizacion_id).where(Usuario.id == usuario_id)
    )
    if organizacion_id is None:
        db.rollback()
        raise OrganizacionNoAutorizada
    organizacion_destino_id = db.scalar(
        select(Rescate.organizacion_id).where(Rescate.id == rescate_id)
    )
    if organizacion_destino_id is None:
        db.rollback()
        raise RescateNoEncontrado
    if organizacion_destino_id != organizacion_id:
        db.rollback()
        raise OrganizacionNoAutorizada

    try:
        actualizado = cambiar_estado(
            db,
            rescate_id,
            RescateEstado.RECOGIDO,
            RescateEstado.ENTREGADO,
            usuario_id,
            cambios={
                "recibido_por": usuario_id,
                "cantidad_recibida": cantidad_recibida,
                "unidad_recibida": unidad_recibida,
                "es_medida": es_medida,
                "personas_beneficiadas": personas_beneficiadas,
            },
            condiciones={"organizacion_id": organizacion_id},
            marca_tiempo="entregado_en",
            detalle={
                "accion": "recepcion_confirmada_por_organizacion",
                "cantidad_recibida": cantidad_recibida,
                "unidad_recibida": unidad_recibida,
                "es_medida": es_medida,
                "personas_beneficiadas": personas_beneficiadas,
            },
        )
        if not actualizado:
            raise ConflictoEstadoRescate
        db.commit()
        rescate = db.get(Rescate, rescate_id)
        if rescate is None:
            raise RuntimeError("El rescate recibido no pudo recuperarse")
        return rescate
    except Exception:
        db.rollback()
        raise


def obtener_detalle_rescate(
    db: Session, rescate_id: UUID, usuario: CurrentUser
) -> dict | None:
    organizacion = aliased(OrganizacionReceptora)
    voluntario = aliased(Usuario)
    creador = aliased(Usuario)
    fundacion = aliased(Usuario)
    row = db.execute(
        select(
            Rescate,
            Comercio.nombre,
            organizacion.nombre,
            organizacion.direccion,
            voluntario.nombre,
            creador.rol,
            fundacion.nombre,
            Usuario.organizacion_id,
            Usuario.comercio_id,
        )
        .join(Comercio, Comercio.id == Rescate.comercio_id)
        .join(creador, creador.id == Rescate.registrado_por)
        .outerjoin(organizacion, organizacion.id == Rescate.organizacion_id)
        .outerjoin(voluntario, voluntario.id == Rescate.voluntario_id)
        .outerjoin(fundacion, fundacion.id == Rescate.asignado_por)
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
        origen_aviso,
        fundacion_nombre,
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
        "organizacion_id": rescate.organizacion_id,
        "voluntario_id": rescate.voluntario_id,
        "hora_limite": rescate.hora_limite,
        "pendiente_asignar": rescate.estado == RescateEstado.DISPONIBLE,
        "comercio": comercio_nombre,
        "alimento": rescate.alimento,
        "cantidad_aprox": rescate.cantidad_aprox,
        "lugar_recogida": rescate.lugar_recogida,
        "lugar_entrega": lugar_entrega,
        "organizacion": organizacion_nombre,
        "voluntario": voluntario_nombre,
        "fundacion": fundacion_nombre,
        "asignado_en": rescate.asignado_en,
        "asignado_por": rescate.asignado_por,
        "observaciones": rescate.observaciones,
        "origen_aviso": origen_aviso.value,
    }
    if usuario.rol == UsuarioRol.ORGANIZACION.value:
        detalle["estado_visual"] = (
            "recibido"
            if rescate.estado == RescateEstado.ENTREGADO
            else "por_recibir"
            if rescate.estado in (RescateEstado.ASIGNADO, RescateEstado.RECOGIDO)
            else rescate.estado.value
        )
    elif usuario.rol == UsuarioRol.VOLUNTARIO.value:
        detalle["estado_visual"] = (
            "entregado_por_voluntario"
            if rescate.estado == RescateEstado.RECOGIDO
            else rescate.estado.value
        )
    if usuario.rol == UsuarioRol.FUNDACION.value:
        return detalle
    if usuario.rol == UsuarioRol.VOLUNTARIO.value:
        return {
            key: detalle[key]
            for key in (
                "id",
                "estado",
                "estado_visual",
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
    if usuario.rol == UsuarioRol.ORGANIZACION.value:
        return {
            key: detalle[key]
            for key in (
                "id",
                "estado",
                "estado_visual",
                "pendiente_asignar",
                "comercio",
                "organizacion",
                "voluntario",
                "fundacion",
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
