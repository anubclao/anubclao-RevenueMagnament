"""
config.py — Settings con Pydantic v2.
Lee de .env automáticamente. Si APP_ENV != 'production' usa DATABASE_URL_LOCAL.
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development")
    app_port: int = Field(default=8000)
    # Mantenemos como str para que Pydantic no intente parsear como JSON.
    # Lo convertimos a lista en una property.
    app_cors_origins: str = Field(default="http://localhost:3000")

    database_url: str = Field(default="")
    database_url_local: str = Field(default="sqlite+aiosqlite:///./bora_bora_rm.db")

    max_upload_mb: int = Field(default=25)
    allowed_upload_extensions: str = Field(default=".xlsx")

    @property
    def cors_origins(self) -> List[str]:
        return [item.strip() for item in self.app_cors_origins.split(",") if item.strip()]

    @property
    def database_url_resolved(self) -> str:
        if self.app_env == "production" and self.database_url:
            return self.database_url
        return self.database_url_local or self.database_url

    @property
    def allowed_extensions(self) -> List[str]:
        return [ext.strip() for ext in self.allowed_upload_extensions.split(",")]


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    # Resolver la URL efectiva según el entorno
    s.database_url = s.database_url_resolved
    return s


# Alias usado en el resto de la app
settings = get_settings()


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Alias usado en el resto de la app
settings = get_settings()
# Resolver la URL al cargar
settings.database_url = settings.database_url_resolved
