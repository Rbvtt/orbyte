# Red de Rescate de Alimentos

Equipo: Orbyte
Alternativa seleccionada: aplicación web responsiva con panel administrativo.

## Qué hace

La Red de Rescate de Alimentos ayuda a la Fundación Mesa Común a organizar los rescates de alimentos. Desde un enlace se podrán registrar avisos, asignar un voluntario, hacer seguimiento del rescate, confirmar la entrega y consultar reportes básicos. La fundación también podrá registrar avisos recibidos por llamada u otro medio cuando un comercio no pueda acceder a la página.

## Arquitectura

```mermaid
flowchart LR
    U["Navegador<br/>celular o computador"] -->|HTTPS| F["Frontend Next.js 16<br/>Vercel"]
    F -->|"REST + JWT<br/>VITE_API_URL"| A["API FastAPI<br/>Render"]
    A -->|"SQLAlchemy<br/>red privada"| D[("PostgreSQL 18<br/>Render")]
    R["Computador del equipo<br/>pg_dump"] -.->|"IP permitida"| D
```

| Parte | Dónde | Qué contiene |
|---|---|---|
| Frontend | `src/frontend/` | Rutas en `src/app/`, pantallas por funcionalidad en `src/features/` y cliente de la API en `src/services/api/` |
| API | `src/backend/app/` | `routers/` (HTTP y permisos), `schemas/` (validación), `services/` (reglas de negocio) y `models.py` |
| Base de datos | `src/backend/migrations/versions/` | Migraciones de Alembic escritas a mano en SQL |

Todo cambio de estado de un rescate pasa por `cambiar_estado()` (`app/services/transiciones.py`): el `UPDATE` condicional y la fila del historial van en la misma transacción.

### Modelo de datos

```mermaid
erDiagram
    usuarios }o--o| comercios : "comercio_id"
    usuarios }o--o| organizaciones_receptoras : "organizacion_id"
    usuarios ||--o| voluntarios : "usuario_id"
    comercios ||--o{ rescates : "comercio_id"
    organizaciones_receptoras |o--o{ rescates : "organizacion_id"
    voluntarios |o--o{ rescates : "voluntario_id"
    usuarios ||--o{ rescates : "registrado_por"
    rescates ||--o{ historial_estados : "rescate_id"
    usuarios ||--o{ historial_estados : "actor_id"

    usuarios {
        uuid id PK
        text email
        enum rol
        enum estado
        bool activo
    }
    comercios {
        uuid id PK
        text nombre
        text direccion
    }
    organizaciones_receptoras {
        uuid id PK
        text nombre
        numeric capacidad_kg
        bool refrigeracion
        text horario_recepcion
    }
    voluntarios {
        uuid usuario_id PK
        text medio_transporte
        text disponibilidad
    }
    rescates {
        uuid id PK
        text alimento
        timestamptz hora_limite
        enum estado
        timestamptz entregado_en
        numeric cantidad_recibida
        text unidad_recibida
        int personas_beneficiadas
    }
    historial_estados {
        bigint id PK
        uuid rescate_id FK
        enum estado_nuevo
        uuid actor_id FK
        jsonb detalle
    }
```

`idempotency_keys` guarda las claves de `POST /api/v1/rescates`. `historial_estados` es de solo inserción (RNF-011).

### Estados de un rescate

```mermaid
stateDiagram-v2
    [*] --> disponible : comercio o fundación registra
    disponible --> asignado : fundación asigna
    asignado --> recogido : voluntario marca la entrega
    recogido --> entregado : organización confirma la recepción
    disponible --> no_completado : fundación cierra o comercio cancela
    asignado --> no_completado : fundación cierra
    entregado --> [*]
    no_completado --> [*]
```

## Cómo levantarlo

El código de la aplicación vive en `src/`: el backend (FastAPI) en `src/backend/` y el frontend (Next.js) en `src/frontend/`.

### Requisitos

- Python 3.14
- Node.js 20.9 o superior
- PostgreSQL 18 (también sirve otra versión reciente)

### Base de datos local

Crea un usuario y las bases, con un usuario administrador de PostgreSQL (`psql` o pgAdmin). En pgAdmin, ejecuta las sentencias **una por una**, porque `CREATE DATABASE` no puede ir dentro de una transacción:

```sql
CREATE ROLE orbyte_dev LOGIN PASSWORD 'una-clave-de-desarrollo';
CREATE DATABASE orbyte OWNER orbyte_dev;
CREATE DATABASE orbyte_test OWNER orbyte_dev;
```

### Variables de entorno

1. Copia `.env.example` como `.env` en la raíz del repositorio y completa:
   - `DATABASE_URL=postgresql://orbyte_dev:una-clave-de-desarrollo@localhost:5432/orbyte`
   - `TEST_DATABASE_URL`, igual pero terminando en `/orbyte_test`. Es opcional: sin ella se omiten las pruebas de integración.
   - `JWT_SECRET`, con el valor que imprima `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
2. El archivo `.env` está en `.gitignore` y nunca se sube al repositorio.
3. En producción las variables se configuran solo en los paneles de Render (backend, ver [Despliegue del backend](#despliegue-del-backend-en-render)) y Vercel (frontend: `VITE_API_URL`).
4. Al arrancar el backend, si no existe, crea automáticamente un administrador inicial con el correo `marcela@gmail.com` y la contraseña por defecto `Admin123*` para desarrollo. Con `ENTORNO=produccion` esa contraseña se rechaza y el administrador no se crea hasta definir un `DEFAULT_ADMIN_PASSWORD` propio.

### Backend

```powershell
cd src/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows (PowerShell). En macOS o Linux: source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

La API queda en `http://localhost:8000`, `GET /health` responde `{"status": "ok"}` y la documentación interactiva está en `http://localhost:8000/docs`.

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

Abre `http://localhost:5173/` para ver la página pública de Orbyte. Desde allí
puedes ir al inicio de sesión o al registro. El token de sesión se guarda solo
en la pestaña actual; abrir una URL protegida en otra pestaña requiere iniciar
sesión de nuevo. La aplicación obtiene el comercio asociado desde
`GET /api/v1/auth/me`.
Los usuarios de fundación seleccionan el comercio desde `GET /api/v1/comercios`;
los usuarios comercio solo pueden registrar avisos para el comercio asociado a
su cuenta.

## Despliegue del backend en Render

`render.yaml` define la API (`orbyte-api`) y la base PostgreSQL (`orbyte-db`), ambas en el plan gratuito y en la región `virginia`. Cada cambio en `src/backend` que llega a `main` despliega la API.

Para crearlo: en el panel de Render, **New → Blueprint**, elige este repositorio y completa las variables que pide:

| Variable | Valor |
|---|---|
| `CORS_ORIGINS` | Dominio de Vercel, con `https://` y sin `/` final. Se puede completar después de desplegar el frontend. |
| `DEFAULT_ADMIN_EMAIL` | Correo de la administradora inicial. |
| `DEFAULT_ADMIN_PASSWORD` | Contraseña propia y larga. Con `Admin123*` o vacía, la administradora no se crea. |

`JWT_SECRET` lo genera Render y `DATABASE_URL` sale de la base. Las migraciones corren al arrancar: si fallan, el despliegue falla. Para verificar, abre `https://<servicio>.onrender.com/health`, que debe responder `{"status":"ok"}`.

Limitaciones del plan gratuito:

- La API se apaga tras 15 minutos sin tráfico y tarda cerca de un minuto en volver (#57).
- La base vence a los 30 días de creada, con 14 días de gracia, y no tiene respaldos (ver [ADR 0001](docs/decisiones/0001-plan-base-de-datos-render.md) y #56).
- La base no acepta conexiones externas salvo las IP que se agreguen en el panel: **orbyte-db → Info → Access Control**. No se ponen en `render.yaml`, porque este repositorio es público.

## Respaldos de la base

El plan gratuito de Render no hace respaldos, así que se hacen con `pg_dump` desde un computador del equipo (#56). Requiere PowerShell 7 y las herramientas cliente de PostgreSQL 18. Los scripts están en `scripts/respaldo/`.

Una sola vez:

1. En Render, agrega la IP pública del computador en **orbyte-db → Info → Access Control**. Si la IP cambia, el respaldo falla hasta que se actualice.
2. Guarda la URL de conexión. El script pide la **External Database URL** de `orbyte-db` y la cifra para tu usuario de Windows:

   ```powershell
   ./scripts/respaldo/respaldar.ps1 -Configurar
   ```

3. Crea la tarea diaria (por defecto a las 20:00; si el computador estaba apagado, corre apenas se pueda):

   ```powershell
   ./scripts/respaldo/respaldar.ps1 -Programar
   ```

Para un respaldo manual, ejecuta `./scripts/respaldo/respaldar.ps1`. Los archivos quedan en `~/OrbyteRespaldos` (se conservan los últimos 14) y el resultado de cada corrida en `respaldos.log`. **Contienen datos personales y hashes de contraseñas:** no se suben al repositorio ni se comparten por chat.

Para comprobar que un respaldo sirve, restáuralo en una base local vacía. Primero, con un usuario administrador, `CREATE DATABASE orbyte_restaurada OWNER orbyte_dev;`. Luego:

```powershell
./scripts/respaldo/restaurar.ps1 -Archivo "$HOME/OrbyteRespaldos/orbyte-AAAAMMDD-HHMMSS.dump"
```

El script solo restaura en un servidor local y en una base sin tablas. Al final muestra la migración aplicada y las filas de cada tabla.

La API desplegada está en `https://orbyte-api-ecow.onrender.com` (documentación en `/docs`).

## Despliegue del frontend en Vercel

El frontend desplegado está en `https://orbyte-dun.vercel.app`. El proyecto de Vercel está en la cuenta de Rbvtt, dueño del repositorio: Vercel no deja que otra cuenta personal lo enlace, aunque tenga permiso de escritura. Cambiar variables, ver los logs o redesplegar se hace desde esa cuenta.

Para crearlo de nuevo: en el panel de Vercel, **Add New → Project**, importa este repositorio y configura:

| Campo | Valor |
|---|---|
| Root Directory | `src/frontend` |
| Framework Preset | Next.js (Vercel lo detecta solo; build e install quedan por defecto) |
| Variable `VITE_API_URL` | `https://orbyte-api-ecow.onrender.com`, sin `/` final, en Production y Preview |

`VITE_API_URL` queda fija en el código cuando se compila. Si cambia, hay que volver a desplegar. Cada merge a `main` despliega solo.

No hace falta un rewrite: Next.js sirve las rutas profundas como `/rescates/123` por sí mismo.

Después del primer despliegue, copia el dominio de producción de Vercel en `CORS_ORIGINS` en Render (hoy `https://orbyte-dun.vercel.app`). Si se dejó vacía al crear el Blueprint, Render no la guarda: hay que agregarla en **orbyte-api → Environment** y redesplegar. Los despliegues de vista previa usan otros dominios: CORS los rechaza y no pueden iniciar sesión contra la API desplegada.

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

`GET /api/v1/auth/me` devuelve la identidad, el rol y, si existe, el comercio
asociado. `GET /api/v1/comercios` requiere rol `fundacion` y devuelve los
comercios disponibles para registrar avisos.

El rol `administrador` administra cuentas pendientes de fundaciones y
comercios. No puede registrar avisos ni gestionar aprobaciones de cuentas de
otros roles.

La fundación puede gestionar únicamente cuentas de comercio desde
`/home` → **Gestionar comercios**. La pantalla permite consultar su estado,
datos de contacto, aprobar cuentas pendientes o rechazadas, y desactivar o
reactivar cuentas aprobadas. La API correspondiente está protegida para el rol
`fundacion`: `GET /api/v1/fundacion/comercios` y las operaciones
`POST /api/v1/fundacion/comercios/{usuario_id}/aprobar`,
`/desactivar` y `/reactivar`.

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
En el formulario del frontend, la fecha y la hora límite se seleccionan con
los controles de calendario y reloj del dispositivo; el año se restringe al
año actual.

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
en `historial_estados`. El campo `asignado_por` siempre se obtiene del usuario
autenticado en el token; nunca se acepta desde el body.

- `200`: devuelve el rescate asignado con organización, voluntario,
  `asignado_en` y `asignado_por`.
- `401`: falta el token o no es válido.
- `403`: el usuario no tiene rol `fundacion`.
- `404`: el rescate, la organización o el voluntario no existe o no está activo.
- `409`: el rescate ya no está disponible; si ya tiene voluntario, el mensaje
  incluye su nombre.
- `422`: body incompleto o con UUID inválidos.

Para poblar la pantalla de asignación, la fundación puede consultar:

- `GET /api/v1/organizaciones`: devuelve `id`, `nombre`, `capacidad_kg`,
  `refrigeracion` y `horario_recepcion` de organizaciones con cuenta aprobada
  y activa.
- `GET /api/v1/voluntarios`: devuelve `id`, `nombre`, `medio_transporte` y
  `disponibilidad` de usuarios voluntarios activos y aprobados.

Ambos listados requieren rol `fundacion` y no exponen correos, hashes de
contraseña ni otros datos sensibles.

Si un rescate no se puede completar, `POST /api/v1/rescates/{id}/no-completado`
permite a `fundacion` cerrarlo con un `motivo` obligatorio mientras esté
`disponible` o `asignado`. La reasignación no está habilitada.

El voluntario asignado puede consultar en `GET /api/v1/rescates/{id}` la hora
límite, el lugar de recogida, la cantidad y el lugar de entrega. Los demás
roles no reciben esos datos del traslado.

La organización destino registra o corrige el conteo de personas beneficiadas
con `PATCH /api/v1/rescates/{id}/beneficiados`, enviando
`{"personas_beneficiadas": 12}`. Solo se acepta para rescates en estado
`entregado`; el valor debe ser un entero no negativo. La operación agrega al
historial el valor anterior y el nuevo, incluso cuando se corrige un conteo,
sin guardar datos personales de las personas beneficiadas.

### Avisos propios del comercio

Desde `/home` → **Gestionar mis avisos**, un comercio puede consultar sus
avisos, su estado y el seguimiento. Solo puede editar o cancelar avisos propios
que sigan `disponible` y no hayan vencido:

- `GET /api/v1/rescates/mis-avisos`: lista exclusivamente los avisos del
  comercio asociado a la sesión.
- `PATCH /api/v1/rescates/{id}`: actualiza los datos del aviso y agrega el
  cambio al historial.
- `POST /api/v1/rescates/{id}/cancelar`: marca el aviso como `no_completado`
  con motivo `Cancelado por el comercio`, sin borrarlo y preservando el
  historial.

Los rescates asignados, finalizados o vencidos no pueden editarse ni cancelarse
por el comercio. Las operaciones también verifican en el backend la propiedad
del aviso.

### Consulta y seguimiento de rescates

`GET /api/v1/rescates?estado=activos` está disponible únicamente para
`fundacion`. El parámetro `estado=activos` es obligatorio; representa los
estados `disponible`, `asignado` y `recogido`, ordenados por `hora_limite`
ascendente. Cada elemento incluye `id`, estado, hora límite, comercio,
organización, voluntario y el campo calculado `pendiente_asignar`, que es
`true` únicamente cuando el estado es `disponible`. También incluye
`origen_aviso` (`comercio` o `fundacion`) para identificar quién registró el
aviso. Los datos completos del traslado no se incluyen en el listado.

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
tokens ni hashes. La organización destino también recibe la referencia del
alimento y, después de la entrega, la cantidad reportada, su unidad, si fue
medida o estimada, quién la recibió, la fecha y hora y el total de personas
beneficiadas. Estos datos se muestran en `/organizacion/recepcion/{id}` y solo
se exponen a la organización asignada.

La organización receptora ve en el detalle los datos necesarios para revisar su
recepción: alimento y cantidad de referencia; cuando ya se entregó, cantidad
recibida, unidad, si fue medida o estimada, nombre de quien la recibió, fecha
de entrega y beneficiarios. Esos campos solo se devuelven a la organización
destino.

### Matriz de permisos por endpoint

Corresponde a lo implementado en `app/routers/`. Todas las rutas llevan el prefijo `/api/v1`, salvo `/health`. Sin token válido la respuesta es `401`; con un rol no permitido, `403`.

| Endpoint | Permitido a | Alcance |
|---|---|---|
| `GET /health` | Público | |
| `POST /auth/login` | Público | Solo cuentas aprobadas y activas |
| `POST /auth/register` | Público | No permite el rol `administrador`. `voluntario` y `organizacion` quedan aprobados; `fundacion` y `comercio`, pendientes |
| `GET /auth/me` | Cualquier usuario autenticado | Su propia sesión |
| `GET /admin/usuarios` | `administrador` | También en `/admin/users` y `/auth/admin/usuarios` |
| `GET /admin/cuentas-pendientes` | `administrador` | También en `/auth/admin/cuentas-pendientes` |
| `POST /admin/usuarios/{id}/aprobar`, `/rechazar`, `/desactivar`, `/reactivar` | `administrador` | También bajo `/auth/admin/usuarios/{id}/` |
| `GET /fundacion/comercios` | `fundacion` | Solo cuentas de comercio |
| `POST /fundacion/comercios/{id}/aprobar`, `/desactivar`, `/reactivar` | `fundacion` | Solo cuentas de comercio |
| `GET /comercios`, `/organizaciones`, `/voluntarios` | `fundacion` | Sin correos ni credenciales |
| `GET /rescates?estado=activos` | `fundacion` | Todos los rescates activos |
| `POST /rescates` | `comercio`, `fundacion` | `comercio`: solo para su comercio |
| `GET /rescates/mis-avisos` | `comercio` | Sus avisos |
| `GET /rescates/mis-asignaciones` | `voluntario`, `organizacion` | Sus asignaciones |
| `GET /rescates/{id}` | `fundacion`, `voluntario`, `organizacion`, `comercio` | `fundacion`: cualquiera. Los demás: solo los relacionados; si no, `404` |
| `GET /rescates/{id}/historial` | `fundacion` | |
| `PATCH /rescates/{id}` | `comercio` | Aviso propio, `disponible` y sin vencer |
| `POST /rescates/{id}/cancelar` | `comercio` | Aviso propio, `disponible` y sin vencer |
| `PATCH /rescates/{id}/asignacion` | `fundacion` | Solo rescates `disponible` |
| `POST /rescates/{id}/no-completado` | `fundacion` | Solo rescates `disponible` o `asignado` |
| `POST /rescates/{id}/entrega-voluntario` | `voluntario` | Solo el voluntario asignado |
| `POST /rescates/{id}/recepcion` | `organizacion` | Solo la organización destino, con el rescate `recogido` |
| `GET /impacto`, `/impacto/detalle` | `fundacion` | Indicadores y rescates entregados del periodo |

`GET /api/v1/impacto?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` calcula los
indicadores de las fechas de calendario indicadas en la zona horaria de Colombia,
incluyendo ambas fechas. Solo cuenta rescates entregados. Devuelve `kg_total`,
`personas_total`, la lista de organizaciones participantes y `rescates_sin_kg`
(cantidades estimadas, excluidas del total de kilogramos).

`GET /api/v1/impacto/detalle?metrica=kg|personas|organizaciones|sin_kg&desde=...&hasta=...`
devuelve el total de la métrica y los rescates que lo respaldan. Los detalles
incluyen fecha de entrega, comercio, organización, cantidad recibida, tipo de
medición y beneficiarios. Para `organizaciones`, los rescates se agrupan por
organización. Ambas rutas rechazan periodos invertidos con `422`. La pantalla
de la fundación está en `/fundacion/impacto`; permite seleccionar cada
indicador, revisar sus rescates, comprobar que el respaldo suma el total y
abrir el historial de cada rescate.

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

La migración `0004` deja ese historial con la forma de #35: `historial_estados`
(`id` BIGSERIAL, `rescate_id`, `estado_anterior`, `estado_nuevo`, `actor_id`,
`ocurrido_en`, `detalle`), de solo inserción: un `UPDATE` o `DELETE` sobre la tabla
falla. El servicio para las transiciones de estado es `cambiar_estado()` de
`app/services/transiciones.py`: hace el `UPDATE` condicional y la fila del
historial en la misma transacción.

La migración `0006` hace que `rescates.unidad_recibida` acepte `kg` o `aproximada`, los
mismos valores que envía la API. Antes la base esperaba `aprox` y la recepción con cantidad
estimada fallaba. La `0007` crea el índice `(estado, entregado_en)` de la consulta de impacto.

La consulta de impacto de CMP-05 (#20) está en `app/services/impacto.py`.
`calcular_impacto(db, desde, hasta)` devuelve los kilogramos medidos, las personas
beneficiadas y las organizaciones distintas de los rescates `entregado` con
`desde <= entregado_en < hasta`. Si no hubo entregas, todo vale 0. También devuelve los
kilogramos y rescates estimados para el aviso del diseño, sin sumarlos a los kilogramos.
`rango_de_fechas(desde, hasta)` convierte días de calendario de Colombia, ambos incluidos,
en ese intervalo.

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

## Prototipos de experiencia de usuario

### Descripción
Esta rama contiene la documentación visual y los prototipos de diseño desarrollados para las historias de UX del proyecto Orbyte. La finalidad es dejar evidencia del diseño propuesto antes de pasar a la implementación en frontend.

### Contenido de la rama
Actualmente esta rama incluye prototipos relacionados con:
- formulario de aviso de alimento disponible
- vista de rescates activos para la fundación
- evidencia de estados, validaciones y comportamiento visual

### Estructura
```text
docs/
├── design/
│   ├── formulario-aviso/
│   │   ├── README.md
│   │   └── prototipo-formulario-aviso-360.png
│   └── rescates-activos/
│       ├── README.md
│       ├── rescates-activos-desktop.jpg
│       └── rescates-activos-mobile.jpg
```

## Documentación

- [Constitución del proyecto](docs/spec/constitucion.md)
- [Especificación de comportamientos](docs/spec/comportamientos.md)
- [Plan técnico](docs/spec/plan-tecnico.md)
- [Decisiones de arquitectura](docs/decisiones/) - se registrarán como ADR cuando se tome una decisión técnica de fondo.

## Uso de asistentes de IA

Se utilizó Codex para acompañar la creación inicial del repositorio y la organización de su documentación. El equipo revisa y valida cada cambio antes de incorporarlo al proyecto.

El detalle de herramientas y usos conocidos está en [USO_IA.md](USO_IA.md).

## Preparación y seguimiento

- [Datos representativos y casos para CMP-02](docs/datos/cmp02/README.md).
- [Revisión del PO y pendientes de aceptación](docs/seguimiento/revision-po-2026-10-29.md).
