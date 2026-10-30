from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_role
from app.schemas.rescates import RescateCreate, RescateOut
from app.services.rescates import crear_rescate


router = APIRouter(prefix="/api/v1/rescates", tags=["rescates"])


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
