"""unidad_recibida acepta 'aproximada' (CMP-04, #20).

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-10

La API (RescateRecepcionIn) y /mis-rescates envían `unidad_recibida = 'aproximada'` cuando la
cantidad es estimada, pero la restricción de 0001 solo aceptaba 'kg' o 'aprox': la recepción
estimada fallaba con un 500. La base pasa a aceptar los mismos valores que la API.
"""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE rescates DROP CONSTRAINT rescates_unidad_recibida_valida;
        UPDATE rescates SET unidad_recibida = 'aproximada' WHERE unidad_recibida = 'aprox';
        ALTER TABLE rescates ADD CONSTRAINT rescates_unidad_recibida_valida
            CHECK (unidad_recibida IS NULL OR unidad_recibida IN ('kg', 'aproximada'));
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE rescates DROP CONSTRAINT rescates_unidad_recibida_valida;
        UPDATE rescates SET unidad_recibida = 'aprox' WHERE unidad_recibida = 'aproximada';
        ALTER TABLE rescates ADD CONSTRAINT rescates_unidad_recibida_valida
            CHECK (unidad_recibida IS NULL OR unidad_recibida IN ('kg', 'aprox'));
        """
    )
