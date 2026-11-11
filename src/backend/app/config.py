"""Configuración del backend leída de variables de entorno.

En local se toma del archivo .env en la raíz del repositorio (ver .env.example).
En Render las variables vienen del panel del servicio y el archivo no existe.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
# Contraseña pública (está en el repositorio): solo sirve en desarrollo.
CONTRASENA_ADMIN_DESARROLLO = "Admin123*"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_ENV, env_file_encoding="utf-8", extra="ignore")

    entorno: str = "desarrollo"
    database_url: str = ""
    jwt_secret: str = ""
    jwt_expires_min: int = 60
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
    default_admin_email: str = "marcela@gmail.com"
    default_admin_password: str = CONTRASENA_ADMIN_DESARROLLO

    @property
    def es_produccion(self) -> bool:
        return self.entorno.strip().lower() == "produccion"

    @property
    def cors_origin_regex(self) -> str | None:
        # En producción solo se aceptan los orígenes de CORS_ORIGINS.
        return None if self.es_produccion else r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

    @property
    def sqlalchemy_database_url(self) -> str:
        # Render entrega postgresql:// (o postgres://); SQLAlchemy necesita el driver explícito.
        for prefijo in ("postgresql://", "postgres://"):
            if self.database_url.startswith(prefijo):
                return "postgresql+psycopg://" + self.database_url[len(prefijo):]
        return self.database_url

    @property
    def cors_origins_list(self) -> list[str]:
        return [origen.strip() for origen in self.cors_origins.split(",") if origen.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
