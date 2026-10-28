# Red de Rescate de Alimentos

Equipo: Orbyte
Alternativa seleccionada: aplicación web responsiva con panel administrativo.

## Qué hace

La Red de Rescate de Alimentos ayuda a la Fundación Mesa Común a organizar los rescates de alimentos. Desde un enlace se podrán registrar avisos, asignar un voluntario, hacer seguimiento del rescate, confirmar la entrega y consultar reportes básicos. La fundación también podrá registrar avisos recibidos por llamada u otro medio cuando un comercio no pueda acceder a la página.

## Cómo levantarlo

El código de la aplicación vive en `src/`: el backend (FastAPI) en `src/backend/` y el frontend (React) en `src/frontend/`.

### Variables de entorno

1. Copia `.env.example` como `.env` en la raíz del repositorio y completa `DATABASE_URL` y `JWT_SECRET`.
2. El archivo `.env` está en `.gitignore` y nunca se sube al repositorio.
3. En producción las variables se configuran solo en los paneles de Render (backend: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_MIN`, `CORS_ORIGINS`) y Vercel (frontend: `VITE_API_URL`).

### Backend

```powershell
cd src/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows (PowerShell). En macOS o Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

La API queda en `http://localhost:8000` y `GET /health` responde `{"status": "ok"}`.

Para correr las pruebas, desde `src/backend` y con el entorno virtual activo:

```powershell
python -m pytest -v
```

## Autenticación y permisos

Para obtener un token, envía el correo y la contraseña a `POST /api/v1/auth/login`:

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fundacion@example.com","password":"tu-clave"}'
```

La respuesta contiene `access_token` y `token_type: "bearer"`. En los endpoints
protegidos envía el token en el encabezado:

```
Authorization: Bearer <access_token>
```

Un `401` significa que falta el token, es inválido, expiró o las credenciales no son válidas. Un `403` significa que el token es válido, pero el rol no tiene permiso para el endpoint.

`JWT_SECRET` es el secreto usado para firmar los tokens y no debe estar vacío ni publicarse. `JWT_EXPIRES_MIN` define su duración en minutos.

### Matriz de permisos propuesta

Los endpoints de negocio aún corresponden a otros issues; donde el plan técnico no determina permisos concretos se marca **Por definir**.

| Endpoint | Permisos |
|---|---|
| `POST /api/v1/auth/login` | Público |
| `POST /rescates` (#6) | `comercio` (solo el suyo) y `fundacion`; `voluntario` y `organizacion` reciben 403 |
| `PATCH /rescates/{id}/asignacion` (#10) | Por definir |
| `POST /rescates/{id}/recogida` (#16) | Por definir |
| `POST /rescates/{id}/entrega` (#17) | Por definir |
| `GET /rescates` y `GET /rescates/{id}` (#37) | Por definir |
| `GET /rescates/{id}/historial` (#43) | Por definir |
| `POST /rescates/{id}/no-completado` (#44) | Por definir |
| `GET /impacto` (#51) | Por definir |

Los datos de personas beneficiadas corresponden únicamente a `fundacion` y a la `organizacion` destino (RNF-005). Los endpoints que los expongan usarán `ROLES_VE_BENEFICIARIOS`.

La relación entre un usuario comercio y `comercios` todavía no existe en el esquema; se resolverá en otro issue.

### Base de datos y migraciones

Las migraciones usan Alembic y están en `src/backend/migrations/versions/`. Toman la base de `DATABASE_URL`. Desde `src/backend`, con el entorno virtual activo:

```powershell
alembic upgrade head      # aplica todas las migraciones
alembic downgrade -1      # revierte la última
alembic current           # muestra la versión aplicada
```

Para crear una migración nueva: `alembic revision -m "descripcion"`. Se escribe a mano con `op.execute()` y siempre se completan `upgrade()` y `downgrade()`.

### Usuarios de desarrollo

Para probar el login necesitas usuarios. El script crea uno por rol
(`fundacion`, `voluntario`, `organizacion`, `comercio`) con correos
`<rol>@example.com` y la contraseña que definas en `SEED_PASSWORD`.
Es idempotente y **solo para desarrollo: no lo ejecutes en producción**.

Desde `src/backend`, con el entorno virtual activo y las migraciones aplicadas:

```powershell
$env:SEED_PASSWORD = "<clave-de-desarrollo>"     # macOS/Linux: export SEED_PASSWORD=...
python -m scripts.seed_dev_usuarios
```

## Documentación

- [Constitución del proyecto](docs/spec/constitucion.md)
- [Especificación de comportamientos](docs/spec/comportamientos.md)
- [Plan técnico](docs/spec/plan-tecnico.md)
- [Decisiones de arquitectura](docs/decisiones/) - se registrarán como ADR cuando se tome una decisión técnica de fondo.

## Uso de asistentes de IA

Se utilizó Codex para acompañar la creación inicial del repositorio y la organización de su documentación. El equipo revisa y valida cada cambio antes de incorporarlo al proyecto.