"""Índice para la consulta de impacto (#20).

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-10

CMP-05 filtra por `estado = 'entregado'` y un rango de `entregado_en` (app/services/impacto.py).
"""

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE INDEX rescates_estado_entregado_en_idx ON rescates (estado, entregado_en);")


def downgrade() -> None:
    op.execute("DROP INDEX rescates_estado_entregado_en_idx;")
