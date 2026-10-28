from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers.auth import router as auth_router
from app.routers.rescates import router as rescates_router
from app.services.rescates import FieldValidationError

settings = get_settings()

app = FastAPI(title="Red de Rescate de Alimentos")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(rescates_router)


def _validation_message(error: dict, field: str) -> str:
    error_type = error.get("type")
    if error_type == "missing":
        return f"El campo {field} es obligatorio"
    if error_type == "string_too_short":
        return f"El campo {field} no puede estar vacío"
    if error_type == "uuid_parsing":
        return f"El campo {field} debe ser un UUID válido"
    if error_type in {"datetime_parsing", "datetime_from_date_parsing"}:
        return f"El campo {field} debe ser una fecha y hora válida"
    if error_type == "value_error" and "zona horaria" in str(error.get("msg", "")):
        return f"El campo {field} debe incluir zona horaria"
    return f"El campo {field} no tiene un formato válido"


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = []
    for error in exc.errors():
        location = error.get("loc", ())
        field = next((str(item) for item in reversed(location) if item != "body"), "request")
        errors.append({"campo": field, "mensaje": _validation_message(error, field)})
    return JSONResponse(status_code=422, content=errors)


@app.exception_handler(FieldValidationError)
async def field_validation_exception_handler(
    _request: Request, exc: FieldValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=[{"campo": exc.field, "mensaje": exc.message}],
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
