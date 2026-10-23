"""Configuración del backend leída de variables de entorno.

En local se toma del archivo .env en la raíz del repositorio (ver .env.example).
En Render las variables vienen del panel del servicio y el archivo no existe.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_ENV, env_file_encoding="utf-8", extra="ignore")

    database_url: str = ""
    jwt_secret: str = ""
    jwt_expires_min: int = 60
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origen.strip() for origen in self.cors_origins.split(",") if origen.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
