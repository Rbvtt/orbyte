"""Garantiza que los estados avanzados tengan un voluntario asignado."""
from alembic import op


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

CONSTRAINT_NAME = "chk_rescates_estado_requiere_voluntario"


def upgrade() -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM rescates
                WHERE estado IN ('asignado', 'recogido', 'entregado')
                  AND voluntario_id IS NULL
            ) THEN
                RAISE EXCEPTION
                    'No se puede crear {CONSTRAINT_NAME}: existen rescates sin voluntario';
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conrelid = 'rescates'::regclass
                  AND conname = '{CONSTRAINT_NAME}'
            ) THEN
                ALTER TABLE rescates
                    ADD CONSTRAINT {CONSTRAINT_NAME}
                    CHECK (
                        estado NOT IN ('asignado', 'recogido', 'entregado')
                        OR voluntario_id IS NOT NULL
                    );
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        ALTER TABLE rescates
            DROP CONSTRAINT IF EXISTS {CONSTRAINT_NAME};
        """
    )
