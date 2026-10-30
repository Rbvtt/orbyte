from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_role
from app.schemas.rescates import (
    RescateAsignacionIn,
    RescateAsignacionOut,
    RescateCreate,
    RescateDetalleOut,
    RescateListaOut,
    RescateOut,
)
from app.services.rescates import (
    ConflictoAsignacion,
    RecursoAsignacionNoEncontrado,
    RescateNoEncontrado,
    asignar_rescate_con_historial,
    crear_rescate,
    listar_rescates_activos,
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
            "organizacion_id": "La organización no existe",
            "voluntario_id": "El voluntario no existe o no está activo",
        }
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=nombres[exc.recurso],
        ) from None
    except ConflictoAsignacion as exc:
        if exc.voluntario_nombre is None:
            detail = "El rescate ya no está disponible para asignación"
        else:
            detail = f"El rescate ya está asignado al voluntario {exc.voluntario_nombre}"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        ) from None
    return RescateAsignacionOut.model_validate(rescate)
