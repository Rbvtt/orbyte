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

```bash
cd src/backend
python -m venv .venv
.venv/Scripts/activate        # en macOS o Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

La API queda en `http://localhost:8000` y `GET /health` responde `{"status": "ok"}`.

### Base de datos y migraciones

Las migraciones usan Alembic y están en `src/backend/migrations/versions/`. Toman la base de `DATABASE_URL`. Desde `src/backend`, con el entorno virtual activo:

```bash
alembic upgrade head      # aplica todas las migraciones
alembic downgrade -1      # revierte la última
alembic current           # muestra la versión aplicada
```

Para crear una migración nueva: `alembic revision -m "descripcion"`. Se escribe a mano con `op.execute()` y siempre se completan `upgrade()` y `downgrade()`.

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

