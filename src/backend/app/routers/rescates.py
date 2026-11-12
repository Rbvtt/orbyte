from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_role
from app.schemas.rescates import (
    RescateAsignacionIn,
    RescateAsignacionOut,
    RescateComercioOut,
    RescateCreate,
    RescateDetalleOut,
    RescateEntregaIn,
    RescateEntregaOut,
    RescateHistorialOut,
    RescateListaOut,
    RescateNoCompletadoIn,
    RescateNoCompletadoOut,
    RescateOut,
    RescateRecepcionIn,
    RescateReasignacionIn,
    RescateUpdate,
)
from app.services.rescates import (
    ConflictoEstadoRescate,
    ConflictoAsignacion,
    OrganizacionNoAutorizada,
    RecursoAsignacionNoEncontrado,
    RescateNoEditable,
    RescateNoEncontrado,
    asignar_rescate_con_historial,
    cancelar_aviso_comercio,
    confirmar_recepcion_organizacion,
    crear_rescate,
    editar_aviso_comercio,
    marcar_entregado_por_voluntario,
    listar_avisos_comercio,
    listar_asignaciones_usuario,
    listar_historial_rescate,
    listar_rescates_activos,
    marcar_no_completado,
    obtener_detalle_rescate,
)


router = APIRouter(prefix="/api/v1/rescates", tags=["rescates"])


@router.get("", response_model=list[RescateListaOut])
def list_rescates(
    estado: str | None = None,
    _current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> list[RescateListaOut]:
    if estado != "activos":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El parámetro estado debe ser 'activos'",
        )
    return [RescateListaOut.model_validate(item) for item in listar_rescates_activos(db)]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=RescateOut,
)
def create_rescate(
    datos: RescateCreate,
    response: Response,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    current_user: CurrentUser = Depends(require_role("comercio", "fundacion")),
    db: Session = Depends(get_db),
) -> RescateOut:
    rescate, replay = crear_rescate(db, current_user, datos, idempotency_key)
    if replay:
        response.headers["Idempotent-Replay"] = "true"
    return RescateOut.model_validate(rescate)


@router.get("/mis-avisos", response_model=list[RescateComercioOut])
def list_comercio_avisos(
    current_user: CurrentUser = Depends(require_role("comercio")),
    db: Session = Depends(get_db),
) -> list[RescateComercioOut]:
    if current_user.comercio_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu usuario no tiene un comercio asociado",
        )
    return [
        RescateComercioOut.model_validate(item)
        for item in listar_avisos_comercio(db, current_user.comercio_id)
    ]


@router.get("/mis-asignaciones", response_model=list[RescateListaOut])
def list_mis_asignaciones(
    current_user: CurrentUser = Depends(require_role("voluntario", "organizacion")),
    db: Session = Depends(get_db),
) -> list[RescateListaOut]:
    return [
        RescateListaOut.model_validate(item)
        for item in listar_asignaciones_usuario(db, current_user)
    ]


@router.post("/{rescate_id}/entrega-voluntario", status_code=status.HTTP_204_NO_CONTENT)
def post_entrega_voluntario(
    rescate_id: UUID,
    current_user: CurrentUser = Depends(require_role("voluntario")),
    db: Session = Depends(get_db),
) -> None:
    if current_user.usuario_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
    try:
        marcar_entregado_por_voluntario(db, rescate_id, current_user.usuario_id)
    except RescateNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El rescate no existe") from None
    except ConflictoEstadoRescate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El rescate ya no está asignado para registrar la entrega",
        ) from None


@router.post("/{rescate_id}/recepcion", status_code=status.HTTP_204_NO_CONTENT)
def post_recepcion_organizacion(
    rescate_id: UUID,
    datos: RescateRecepcionIn,
    current_user: CurrentUser = Depends(require_role("organizacion")),
    db: Session = Depends(get_db),
) -> None:
    if current_user.usuario_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
    try:
        confirmar_recepcion_organizacion(
            db,
            rescate_id,
            current_user.usuario_id,
            datos.cantidad_recibida,
            datos.unidad_recibida,
            datos.es_medida,
            datos.personas_beneficiadas,
        )
    except OrganizacionNoAutorizada:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu organización no es el destino de este rescate",
        ) from None
    except RescateNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El rescate no existe") from None
    except ConflictoEstadoRescate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El rescate todavía no está entregado por el voluntario",
        ) from None


@router.post(
    "/{rescate_id}/entrega",
    response_model=RescateEntregaOut,
    status_code=status.HTTP_200_OK,
)
def post_entrega_organizacion(
    rescate_id: UUID,
    datos: RescateEntregaIn,
    current_user: CurrentUser = Depends(require_role("organizacion")),
    db: Session = Depends(get_db),
) -> RescateEntregaOut:
    if current_user.usuario_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
    if datos.recibido_por != current_user.usuario_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario que recibe debe ser el usuario autenticado",
        )
    try:
        rescate = confirmar_recepcion_organizacion(
            db,
            rescate_id,
            current_user.usuario_id,
            datos.cantidad_recibida,
            datos.unidad,
            datos.es_medida,
            datos.personas_beneficiadas,
        )
    except OrganizacionNoAutorizada:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu organización no es el destino de este rescate",
        ) from None
    except RescateNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El rescate no existe") from None
    except ConflictoEstadoRescate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El rescate no está recogido o ya fue entregado",
        ) from None
    return RescateEntregaOut.model_validate(rescate)


@router.get(
    "/{rescate_id}/historial",
    response_model=list[RescateHistorialOut],
)
def get_historial_rescate(
    rescate_id: UUID,
    _current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> list[RescateHistorialOut]:
    try:
        historial = listar_historial_rescate(db, rescate_id)
    except RescateNoEncontrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El rescate no existe",
        ) from None
    return [RescateHistorialOut.model_validate(item) for item in historial]


@router.get(
    "/{rescate_id}",
    response_model=RescateDetalleOut,
    response_model_exclude_none=True,
)
def get_rescate(
    rescate_id: UUID,
    current_user: CurrentUser = Depends(
        require_role("fundacion", "voluntario", "organizacion", "comercio")
    ),
    db: Session = Depends(get_db),
) -> RescateDetalleOut:
    detalle = obtener_detalle_rescate(db, rescate_id, current_user)
    if detalle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El rescate no existe",
        )
    return RescateDetalleOut.model_validate(detalle)


@router.patch("/{rescate_id}", response_model=RescateComercioOut)
def update_comercio_aviso(
    rescate_id: UUID,
    datos: RescateUpdate,
    current_user: CurrentUser = Depends(require_role("comercio")),
    db: Session = Depends(get_db),
) -> RescateComercioOut:
    if current_user.usuario_id is None or current_user.comercio_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu usuario no tiene un comercio asociado",
        )
    try:
        rescate = editar_aviso_comercio(
            db, rescate_id, current_user.comercio_id, current_user.usuario_id, datos
        )
    except RescateNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El aviso no existe") from None
    except RescateNoEditable:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo puedes editar avisos disponibles que no hayan vencido",
        ) from None
    return RescateComercioOut.model_validate(rescate)


@router.post("/{rescate_id}/cancelar", response_model=RescateComercioOut)
def cancel_comercio_aviso(
    rescate_id: UUID,
    current_user: CurrentUser = Depends(require_role("comercio")),
    db: Session = Depends(get_db),
) -> RescateComercioOut:
    if current_user.usuario_id is None or current_user.comercio_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu usuario no tiene un comercio asociado",
        )
    try:
        rescate = cancelar_aviso_comercio(
            db, rescate_id, current_user.comercio_id, current_user.usuario_id
        )
    except RescateNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El aviso no existe") from None
    except RescateNoEditable:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo puedes cancelar avisos disponibles que no hayan vencido",
        ) from None
    return RescateComercioOut.model_validate(rescate)


@router.post(
    "/{rescate_id}/no-completado",
    response_model=RescateNoCompletadoOut,
)
def post_no_completado(
    rescate_id: UUID,
    datos: RescateNoCompletadoIn,
    current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> RescateNoCompletadoOut:
    if current_user.usuario_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
    try:
        rescate = marcar_rescate_no_completado(
            db, rescate_id, current_user.usuario_id, datos.motivo
        )
    except RescateNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El rescate no existe") from None
    except ConflictoEstadoRescate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se pueden marcar como no completados rescates disponibles o asignados",
        ) from None
    return RescateNoCompletadoOut.model_validate(rescate)


def _guardar_asignacion(
    rescate_id: UUID,
    datos: RescateAsignacionIn,
    current_user: CurrentUser,
    db: Session,
) -> RescateAsignacionOut:
    if current_user.usuario_id is None:
        raise RuntimeError("El usuario autenticado no tiene un identificador")
    try:
        rescate = asignar_rescate_con_historial(
            db,
            rescate_id,
            datos.voluntario_id,
            datos.organizacion_id,
            current_user.usuario_id,
        )
    except RescateNoEncontrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El rescate no existe",
        ) from None
    except RecursoAsignacionNoEncontrado as exc:
        nombres = {
            "organizacion_id": "La organización no existe o no está activa",
            "voluntario_id": "El voluntario no existe o no está activo",
        }
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=nombres[exc.recurso],
        ) from None
    except ConflictoAsignacion as exc:
        detail = (
            "El rescate ya no está disponible para asignación"
            if exc.voluntario_nombre is None
            else f"El rescate ya está asignado al voluntario {exc.voluntario_nombre}"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        ) from None
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from None
    return RescateAsignacionOut.model_validate(rescate)


@router.patch(
    "/{rescate_id}/asignacion",
    response_model=RescateAsignacionOut,
)
def assign_rescate(
    rescate_id: UUID,
    datos: RescateAsignacionIn,
    current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> RescateAsignacionOut:
    return _guardar_asignacion(rescate_id, datos, current_user, db, solo_reasignar=False)


@router.patch(
    "/{rescate_id}/reasignacion",
    response_model=RescateAsignacionOut,
)
def reassign_rescate(
    rescate_id: UUID,
    datos: RescateReasignacionIn,
    current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> RescateAsignacionOut:
    return _guardar_asignacion(rescate_id, datos, current_user, db, solo_reasignar=True)


@router.post(
    "/{rescate_id}/no-completado",
    response_model=RescateNoCompletadoOut,
)
def close_rescate_no_completado(
    rescate_id: UUID,
    datos: RescateNoCompletadoIn,
    current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> RescateNoCompletadoOut:
    if current_user.usuario_id is None:
        raise RuntimeError("El usuario autenticado no tiene un identificador")
    try:
        rescate = marcar_no_completado(
            db, rescate_id, current_user.usuario_id, datos.motivo
        )
    except RescateNoEncontrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El rescate no existe",
        ) from None
    if rescate is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se pueden cerrar como no completados los rescates disponibles o asignados",
        )
    return RescateNoCompletadoOut.model_validate(rescate)
