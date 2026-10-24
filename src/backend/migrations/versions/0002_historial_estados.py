"""Historial de estados de solo inserción.

Issue: #35 · CA-03.3 · RF-014, RF-015, RNF-011.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-23
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


UPGRADE = r"""
-- Cada movimiento del rescate queda como evidencia que no se altera en silencio.
CREATE TABLE historial_estados (
    id                  BIGSERIAL PRIMARY KEY,
    rescate_id          UUID NOT NULL REFERENCES rescates (id),
    estado_anterior     rescate_estado,
    estado_nuevo        rescate_estado NOT NULL,
    actor_id            UUID NOT NULL REFERENCES usuarios (id),
    ocurrido_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    detalle             JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX historial_por_rescate ON historial_estados (rescate_id, ocurrido_en, id);

-- RNF-011: el rol de la aplicación (el usuario con el que corre la migración) solo puede insertar.
REVOKE UPDATE, DELETE ON historial_estados FROM PUBLIC;
REVOKE UPDATE, DELETE ON historial_estados FROM CURRENT_USER;

-- Además un trigger: si la aplicación se conecta como superusuario (por ejemplo `postgres`
-- en local), el REVOKE no lo detiene y el UPDATE o DELETE igual debe fallar.
CREATE FUNCTION historial_es_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'historial_estados es de solo inserción: no se permite %', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER historial_sin_update_ni_delete
    BEFORE UPDATE OR DELETE ON historial_estados
    FOR EACH ROW EXECUTE FUNCTION historial_es_inmutable();
"""

DOWNGRADE = r"""
DROP TRIGGER IF EXISTS historial_sin_update_ni_delete ON historial_estados;
DROP FUNCTION IF EXISTS historial_es_inmutable();
DROP TABLE IF EXISTS historial_estados;
"""


def upgrade() -> None:
    op.execute(UPGRADE)


def downgrade() -> None:
    op.execute(DOWNGRADE)
