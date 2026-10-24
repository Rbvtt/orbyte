"""Esquema inicial: usuarios, comercios, organizaciones_receptoras, voluntarios y rescates

Revision ID: 0001
Revises:
Create Date: 2026-10-23

Issue #5. Soporta el ciclo de vida completo del rescate:
disponible -> asignado -> recogido -> entregado (o no_completado).
"""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TYPE rescate_estado AS ENUM
            ('disponible', 'asignado', 'recogido', 'entregado', 'no_completado');

        CREATE TYPE usuario_rol AS ENUM
            ('fundacion', 'voluntario', 'organizacion', 'comercio');

        -- RF-002: atributos de recepción de cada organización
        CREATE TABLE organizaciones_receptoras (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nombre            TEXT NOT NULL,
            direccion         TEXT NOT NULL,
            capacidad_kg      NUMERIC(10, 2) CHECK (capacidad_kg IS NULL OR capacidad_kg >= 0),
            refrigeracion     BOOLEAN NOT NULL DEFAULT false,
            horario_recepcion TEXT,
            puede_recoger     BOOLEAN NOT NULL DEFAULT false
        );

        CREATE TABLE comercios (
            id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nombre    TEXT NOT NULL,
            direccion TEXT NOT NULL,
            telefono  TEXT
        );

        CREATE TABLE usuarios (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nombre          TEXT NOT NULL,
            email           TEXT NOT NULL UNIQUE,
            password_hash   TEXT NOT NULL,
            rol             usuario_rol NOT NULL,
            organizacion_id UUID REFERENCES organizaciones_receptoras (id),
            activo          BOOLEAN NOT NULL DEFAULT true
        );

        -- RF-006: datos del voluntario
        CREATE TABLE voluntarios (
            usuario_id       UUID PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,
            medio_transporte TEXT,
            disponibilidad   TEXT
        );

        CREATE TABLE rescates (
            id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

            -- Aviso: los 5 datos mínimos (CA-01.1)
            comercio_id           UUID NOT NULL REFERENCES comercios (id),
            alimento              TEXT NOT NULL,
            cantidad_aprox        TEXT NOT NULL,
            lugar_recogida        TEXT NOT NULL,
            hora_limite           TIMESTAMPTZ NOT NULL,
            observaciones         TEXT,
            estado                rescate_estado NOT NULL DEFAULT 'disponible',
            registrado_por        UUID NOT NULL REFERENCES usuarios (id),
            creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),

            -- Asignación (CMP-02)
            organizacion_id       UUID REFERENCES organizaciones_receptoras (id),
            voluntario_id         UUID REFERENCES voluntarios (usuario_id),
            asignado_en           TIMESTAMPTZ,
            asignado_por          UUID REFERENCES usuarios (id),

            -- Recogida y entrega (CMP-04)
            recogido_en           TIMESTAMPTZ,
            entregado_en          TIMESTAMPTZ,
            recibido_por          UUID REFERENCES usuarios (id),
            cantidad_recibida     NUMERIC(10, 2),
            unidad_recibida       TEXT,
            es_medida             BOOLEAN,
            personas_beneficiadas INTEGER,

            -- Cierre sin entrega (CA-03.4)
            motivo_no_completado  TEXT,

            CONSTRAINT rescates_unidad_recibida_valida
                CHECK (unidad_recibida IS NULL OR unidad_recibida IN ('kg', 'aprox')),
            CONSTRAINT rescates_cantidad_recibida_no_negativa
                CHECK (cantidad_recibida IS NULL OR cantidad_recibida >= 0),
            CONSTRAINT rescates_no_completado_con_motivo
                CHECK (estado <> 'no_completado' OR motivo_no_completado IS NOT NULL),
            CONSTRAINT rescates_entregado_con_recepcion
                CHECK (estado <> 'entregado' OR (recibido_por IS NOT NULL AND cantidad_recibida IS NOT NULL)),
            CONSTRAINT rescates_personas_beneficiadas_no_negativas
                CHECK (personas_beneficiadas IS NULL OR personas_beneficiadas >= 0)
        );

        CREATE INDEX rescates_estado_idx ON rescates (estado);
        CREATE INDEX rescates_comercio_id_idx ON rescates (comercio_id);
        CREATE INDEX rescates_organizacion_id_idx ON rescates (organizacion_id);
        CREATE INDEX rescates_voluntario_id_idx ON rescates (voluntario_id);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE rescates;
        DROP TABLE voluntarios;
        DROP TABLE usuarios;
        DROP TABLE comercios;
        DROP TABLE organizaciones_receptoras;
        DROP TYPE usuario_rol;
        DROP TYPE rescate_estado;
        """
    )
