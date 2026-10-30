"""historial_estados append-only (#35).

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-30

Issue #35 · CA-03.3 · RF-014, RF-015, RNF-011. La migración 0002 (#6) creó el historial como
`rescate_historial`; aquí queda con la forma que pide #35:

    historial_estados(id BIGSERIAL, rescate_id FK, estado_anterior NULL, estado_nuevo,
                      actor_id FK, ocurrido_en TIMESTAMPTZ DEFAULT now(), detalle JSONB)

Las filas que ya existan se conservan (los ids nuevos siguen el orden en que ocurrieron).
Además, el historial no se puede modificar ni borrar.
"""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


UPGRADE = r"""
ALTER TABLE rescate_historial RENAME TO historial_estados;
ALTER TABLE historial_estados RENAME COLUMN cambiado_por TO actor_id;
ALTER TABLE historial_estados RENAME COLUMN cambiado_en TO ocurrido_en;
ALTER INDEX rescate_historial_rescate_id_idx RENAME TO historial_estados_rescate_id_idx;

-- id BIGSERIAL: numera las filas existentes en orden cronológico.
ALTER TABLE historial_estados DROP CONSTRAINT rescate_historial_pkey;
ALTER TABLE historial_estados RENAME COLUMN id TO id_anterior;
CREATE SEQUENCE historial_estados_id_seq AS BIGINT;
ALTER TABLE historial_estados ADD COLUMN id BIGINT;
UPDATE historial_estados h
   SET id = o.n
  FROM (SELECT id_anterior, row_number() OVER (ORDER BY ocurrido_en, id_anterior) AS n FROM historial_estados) o
 WHERE h.id_anterior = o.id_anterior;
SELECT setval('historial_estados_id_seq', COALESCE((SELECT max(id) FROM historial_estados), 0) + 1, false);
ALTER TABLE historial_estados ALTER COLUMN id SET DEFAULT nextval('historial_estados_id_seq');
ALTER TABLE historial_estados ALTER COLUMN id SET NOT NULL;
ALTER SEQUENCE historial_estados_id_seq OWNED BY historial_estados.id;
ALTER TABLE historial_estados DROP COLUMN id_anterior;
ALTER TABLE historial_estados ADD CONSTRAINT historial_estados_pkey PRIMARY KEY (id);

-- Detalle de cada transición (por ejemplo la organización y el voluntario asignados).
ALTER TABLE historial_estados ADD COLUMN detalle JSONB NOT NULL DEFAULT '{}'::jsonb;

-- RNF-011: el rol de la aplicación (el usuario con el que corre la migración) solo puede insertar.
REVOKE UPDATE, DELETE ON historial_estados FROM PUBLIC;
REVOKE UPDATE, DELETE ON historial_estados FROM CURRENT_USER;

-- Además un trigger: si la aplicación se conecta como superusuario (por ejemplo `postgres`
-- en local), el REVOKE no lo detiene y el UPDATE o DELETE igual debe fallar.
CREATE FUNCTION historial_estados_es_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'historial_estados es de solo inserción: no se permite %', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER historial_estados_sin_update_ni_delete
    BEFORE UPDATE OR DELETE ON historial_estados
    FOR EACH ROW EXECUTE FUNCTION historial_estados_es_inmutable();
"""

DOWNGRADE = r"""
DROP TRIGGER IF EXISTS historial_estados_sin_update_ni_delete ON historial_estados;
DROP FUNCTION IF EXISTS historial_estados_es_inmutable();
GRANT UPDATE, DELETE ON historial_estados TO CURRENT_USER;
ALTER TABLE historial_estados DROP COLUMN detalle;

ALTER TABLE historial_estados DROP CONSTRAINT historial_estados_pkey;
ALTER TABLE historial_estados ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE historial_estados_id_seq;
ALTER TABLE historial_estados DROP COLUMN id;
ALTER TABLE historial_estados ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE historial_estados ADD CONSTRAINT rescate_historial_pkey PRIMARY KEY (id);

ALTER INDEX historial_estados_rescate_id_idx RENAME TO rescate_historial_rescate_id_idx;
ALTER TABLE historial_estados RENAME COLUMN ocurrido_en TO cambiado_en;
ALTER TABLE historial_estados RENAME COLUMN actor_id TO cambiado_por;
ALTER TABLE historial_estados RENAME TO rescate_historial;
"""


def upgrade() -> None:
    op.execute(UPGRADE)


def downgrade() -> None:
    op.execute(DOWNGRADE)
