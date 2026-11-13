"""unidad_recibida vuelve a 'kg' o 'aprox' (CMP-04).

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-12

La 0006 cambió la restricción a ('kg', 'aproximada') porque el antiguo formulario de
/mis-rescates enviaba 'aproximada'. Después, POST /rescates/{id}/entrega y la pantalla
/organizacion/recepcion/{id} adoptaron 'aprox', como dice la especificación (#46) y como era
la restricción original de 0001, y el endpoint antiguo /recepcion normaliza 'aproximada' a
'aprox'. Con la 0006 aplicada, toda recepción estimada fallaba con un 500. El valor guardado
pasa a ser siempre 'aprox'.
"""

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE rescates DROP CONSTRAINT rescates_unidad_recibida_valida;
        UPDATE rescates SET unidad_recibida = 'aprox' WHERE unidad_recibida = 'aproximada';
        ALTER TABLE rescates ADD CONSTRAINT rescates_unidad_recibida_valida
            CHECK (unidad_recibida IS NULL OR unidad_recibida IN ('kg', 'aprox'));
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE rescates DROP CONSTRAINT rescates_unidad_recibida_valida;
        UPDATE rescates SET unidad_recibida = 'aproximada' WHERE unidad_recibida = 'aprox';
        ALTER TABLE rescates ADD CONSTRAINT rescates_unidad_recibida_valida
            CHECK (unidad_recibida IS NULL OR unidad_recibida IN ('kg', 'aproximada'));
        """
    )
