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

### Frontend

```powershell
cd src/frontend
npm install
npm run dev
```

La aplicación queda en `http://localhost:5173` (el origen que ya permite `CORS_ORIGINS`) y toma la URL de la API de `VITE_API_URL` en el `.env` de la raíz.

Mientras no exista la pantalla de inicio de sesión, para probar se guarda en el navegador (consola de las herramientas de desarrollador) el token del login del rol que se quiere probar. El formulario de aviso además necesita el comercio del usuario, que la API todavía no expone:

```js
localStorage.setItem("rescate.token", "<access_token>");
localStorage.setItem("rescate.comercio_id", "<id del comercio del usuario>");
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

### Registro de rescates

`POST /api/v1/rescates` registra un aviso en estado `disponible`. Está
permitido para los roles `comercio` y `fundacion`. Un usuario `comercio` debe
tener `usuarios.comercio_id` asociado y solo puede registrar avisos para ese
comercio; `fundacion` puede registrar para cualquier comercio existente.

El header opcional `Idempotency-Key` (entre 1 y 255 caracteres) permite repetir
la misma solicitud sin crear otro rescate. Una repetición devuelve `201` y el
header `Idempotent-Replay: true`. Los códigos principales son `201`, `401`,
`403`, `409` para reutilización de una clave con otro contenido y `422` para
errores de validación.

```bash
curl -X POST http://localhost:8000/api/v1/rescates \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: aviso-pan-001" \
  -d '{
    "comercio_id": "00000000-0000-0000-0000-000000000001",
    "alimento": "Pan",
    "cantidad_aprox": "20 unidades",
    "lugar_recogida": "Calle 1",
    "hora_limite": "2026-10-28T18:00:00-05:00",
    "observaciones": "Recoger por la puerta lateral"
  }'
```

La respuesta contiene `id`, `estado: "disponible"`, `registrado_por` y
`creado_en`, asignados por el servidor. `hora_limite` debe incluir zona
horaria. Los errores `422` se devuelven directamente como
`[{"campo": "...", "mensaje": "..."}]`.

### Asignación de rescates

`PATCH /api/v1/rescates/{id}/asignacion` permite a un usuario con rol
`fundacion` asignar una organización receptora y un voluntario:

```json
{
  "organizacion_id": "uuid-de-la-organizacion",
  "voluntario_id": "uuid-del-voluntario"
}
```

La operación es atómica y registra la transición `disponible` -> `asignado`
en `rescate_historial`. El campo `asignado_por` siempre se obtiene del usuario
autenticado en el token; nunca se acepta desde el body.

- `200`: devuelve el rescate asignado con organización, voluntario,
  `asignado_en` y `asignado_por`.
- `401`: falta el token o no es válido.
- `403`: el usuario no tiene rol `fundacion`.
- `404`: el rescate, la organización o el voluntario no existe o el voluntario
  está inactivo.
- `409`: el rescate ya no está disponible; si ya tiene voluntario, el mensaje
  incluye su nombre.
- `422`: body incompleto o con UUID inválidos.

Para poblar la pantalla de asignación, la fundación puede consultar:

- `GET /api/v1/organizaciones`: devuelve `id`, `nombre`, `capacidad_kg`,
  `refrigeracion` y `horario_recepcion`.
- `GET /api/v1/voluntarios`: devuelve `id`, `nombre`, `medio_transporte` y
  `disponibilidad` de usuarios voluntarios activos.

Ambos listados requieren rol `fundacion` y no exponen correos, hashes de
contraseña ni otros datos sensibles.

### Consulta y seguimiento de rescates

`GET /api/v1/rescates?estado=activos` está disponible únicamente para
`fundacion`. El parámetro `estado=activos` es obligatorio; representa los
estados `disponible`, `asignado` y `recogido`, ordenados por `hora_limite`
ascendente. Cada elemento incluye `id`, estado, hora límite, comercio,
organización, voluntario y el campo calculado `pendiente_asignar`, que es
`true` únicamente cuando el estado es `disponible`. Los datos completos del
traslado no se incluyen en el listado.

`GET /api/v1/rescates/{id}` requiere autenticación y aplica estos permisos:

- `fundacion` puede consultar cualquier rescate.
- `voluntario` solo puede consultar rescates donde sea el voluntario asignado.
- `organizacion` solo puede consultar rescates destinados a su organización.
- `comercio` solo puede consultar rescates de sus propios avisos.

Un rescate inexistente o sin permiso responde `404` para no revelar la
existencia del recurso. El voluntario asignado recibe los cuatro datos del
traslado: `lugar_recogida`, `hora_limite`, `cantidad_aprox` y
`lugar_entrega`, derivado de `organizaciones_receptoras.direccion`. Los
campos devueltos se filtran según el rol y nunca incluyen credenciales,
tokens ni hashes.

### Matriz de permisos propuesta

Los endpoints de negocio aún corresponden a otros issues; donde el plan técnico no determina permisos concretos se marca **Por definir**.

| Endpoint | Permisos |
|---|---|
| `POST /api/v1/auth/login` | Público |
| `POST /rescates` (#6) | `comercio` (solo el suyo) y `fundacion`; `voluntario` y `organizacion` reciben 403 |
| `PATCH /rescates/{id}/asignacion` (#10) | `fundacion` |
| `GET /rescates?estado=activos` (#37) | `fundacion` |
| `GET /rescates/{id}` (#37) | Según propietario o asignación |
| `POST /rescates/{id}/recogida` (#16) | Por definir |
| `POST /rescates/{id}/entrega` (#17) | Por definir |
| `GET /rescates` y `GET /rescates/{id}` (#37) | Por definir |
| `GET /rescates/{id}/historial` (#43) | Por definir |
| `POST /rescates/{id}/no-completado` (#44) | Por definir |
| `GET /impacto` (#51) | Por definir |

Los datos de personas beneficiadas corresponden únicamente a `fundacion` y a la `organizacion` destino (RNF-005). Los endpoints que los expongan usarán `ROLES_VE_BENEFICIARIOS`.

La relación entre un usuario comercio y `comercios` se almacena en
`usuarios.comercio_id` y se agrega en la migración `0002`.

### Base de datos y migraciones

Las migraciones usan Alembic y están en `src/backend/migrations/versions/`. Toman la base de `DATABASE_URL`. Desde `src/backend`, con el entorno virtual activo:

```powershell
alembic upgrade head      # aplica todas las migraciones
alembic downgrade -1      # revierte la última
alembic current           # muestra la versión aplicada
```

La migración `0002` agrega la relación usuario-comercio, el historial de
estados de rescates y las claves de idempotencia.

Para crear una migración nueva: `alembic revision -m "descripcion"`. Se escribe a mano con `op.execute()` y siempre se completan `upgrade()` y `downgrade()`.

### Usuarios de desarrollo

Para probar el login necesitas usuarios. El script crea uno por rol (`fundacion`, `voluntario`, `organizacion`, `comercio`) con correos `<rol>@example.com` y la contraseña que definas en `SEED_PASSWORD`.

Es idempotente y **solo para desarrollo: no lo ejecutes en producción**.

Desde `src/backend`, con el entorno virtual activo y las migraciones aplicadas:

```powershell
$env:SEED_PASSWORD = "<clave-de-desarrollo>"
python -m scripts.seed_dev_usuarios
```

Los tests que necesitan PostgreSQL se ejecutan únicamente si se define `TEST_DATABASE_URL` (por ejemplo, en `.env`); si no está definida, pytest los marca como omitidos. SQLite no es compatible con el esquema PostgreSQL.

## Documentación

- [Constitución del proyecto](docs/spec/constitucion.md)
- [Especificación de comportamientos](docs/spec/comportamientos.md)
- [Plan técnico](docs/spec/plan-tecnico.md)
- [Decisiones de arquitectura](docs/decisiones/) - se registrarán como ADR cuando se tome una decisión técnica de fondo.

## Uso de asistentes de IA

Se utilizó Codex para acompañar la creación inicial del repositorio y la organización de su documentación. El equipo revisa y valida cada cambio antes de incorporarlo al proyecto.