"""Relacion comercio-usuario, historial de rescates e idempotencia."""
from alembic import op


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE EXTENSION IF NOT EXISTS pgcrypto;

        ALTER TABLE usuarios
            ADD COLUMN comercio_id UUID REFERENCES comercios (id);
        CREATE INDEX usuarios_comercio_id_idx ON usuarios (comercio_id);

        CREATE TABLE rescate_historial (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            rescate_id      UUID NOT NULL REFERENCES rescates (id) ON DELETE CASCADE,
            estado_anterior rescate_estado,
            estado_nuevo    rescate_estado NOT NULL,
            cambiado_por    UUID NOT NULL REFERENCES usuarios (id),
            cambiado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX rescate_historial_rescate_id_idx
            ON rescate_historial (rescate_id);

        CREATE TABLE idempotency_keys (
            usuario_id  UUID NOT NULL REFERENCES usuarios (id),
            clave       TEXT NOT NULL,
            request_hash TEXT NOT NULL,
            rescate_id  UUID NOT NULL REFERENCES rescates (id) ON DELETE CASCADE,
            creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (usuario_id, clave)
        );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE idempotency_keys;
        DROP TABLE rescate_historial;
        DROP INDEX usuarios_comercio_id_idx;
        ALTER TABLE usuarios DROP COLUMN comercio_id;
        """
    )
