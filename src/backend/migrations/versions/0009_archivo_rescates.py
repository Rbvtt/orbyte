"""Permite archivar y restaurar rescates sin borrar su historial."""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE rescates
        ADD COLUMN archivado BOOLEAN NOT NULL DEFAULT FALSE;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE rescates DROP COLUMN archivado;
        """
    )
