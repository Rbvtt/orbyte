"""Agrega estados de cuenta para usuarios y el rol administrador."""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'usuario_estado') THEN
                CREATE TYPE usuario_estado AS ENUM ('pendiente', 'aprobado', 'rechazado', 'inactivo');
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'usuario_rol'::regtype AND enumlabel = 'administrador') THEN
                ALTER TYPE usuario_rol ADD VALUE 'administrador';
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        ALTER TABLE usuarios
            ADD COLUMN IF NOT EXISTS estado usuario_estado NOT NULL DEFAULT 'aprobado',
            ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT,
            ADD COLUMN IF NOT EXISTS estado_actualizado_por UUID REFERENCES usuarios (id),
            ADD COLUMN IF NOT EXISTS estado_actualizado_en TIMESTAMPTZ;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE usuarios
            DROP COLUMN IF EXISTS estado_actualizado_en,
            DROP COLUMN IF EXISTS estado_actualizado_por,
            DROP COLUMN IF EXISTS motivo_rechazo,
            DROP COLUMN IF EXISTS estado;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'usuario_rol'::regtype AND enumlabel = 'administrador') THEN
                -- PostgreSQL no admite remover un valor con ALTER TYPE; en downgrade se conserva el tipo.
                NULL;
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DROP TYPE IF EXISTS usuario_estado;
        """
    )
