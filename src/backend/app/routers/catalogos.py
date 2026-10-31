from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, require_role
from app.models import Comercio, OrganizacionReceptora, Usuario, UsuarioRol, Voluntario
from app.schemas.rescates import ComercioOut, OrganizacionOut, VoluntarioOut


router = APIRouter(prefix="/api/v1", tags=["catalogos"])


@router.get("/comercios", response_model=list[ComercioOut])
def list_comercios(
    _current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> list[ComercioOut]:
    comercios = db.scalars(select(Comercio).order_by(Comercio.nombre)).all()
    return [ComercioOut.model_validate(item) for item in comercios]


@router.get("/organizaciones", response_model=list[OrganizacionOut])
def list_organizaciones(
    _current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> list[OrganizacionOut]:
    organizaciones = db.scalars(
        select(OrganizacionReceptora).order_by(OrganizacionReceptora.nombre)
    ).all()
    return [OrganizacionOut.model_validate(item) for item in organizaciones]


@router.get("/voluntarios", response_model=list[VoluntarioOut])
def list_voluntarios(
    _current_user: CurrentUser = Depends(require_role("fundacion")),
    db: Session = Depends(get_db),
) -> list[VoluntarioOut]:
    rows = db.execute(
        select(Voluntario, Usuario.nombre)
        .join(Usuario, Usuario.id == Voluntario.usuario_id)
        .where(
            Usuario.rol == UsuarioRol.VOLUNTARIO,
            Usuario.activo.is_(True),
        )
        .order_by(Usuario.nombre)
    ).all()
    return [
        VoluntarioOut(
            id=voluntario.usuario_id,
            nombre=nombre,
            medio_transporte=voluntario.medio_transporte,
            disponibilidad=voluntario.disponibilidad,
        )
        for voluntario, nombre in rows
    ]
