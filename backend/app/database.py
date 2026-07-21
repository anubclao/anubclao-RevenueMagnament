"""
database.py — Conexión async a MySQL (producción) o SQLite (dev).

Estrategia:
- Producción: MySQL via asyncmy + async_sessionmaker.
- Dev local: SQLite via aiosqlite, mismo engine, misma API.
- pool_pre_ping=True para sobrevivir a conexiones MySQL cerradas por el host
  (Hostinger a veces recicla conexiones idle después de 60s).
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from loguru import logger
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import AsyncAdaptedQueuePool

from .config import settings


def _build_engine() -> AsyncEngine:
    url = settings.database_url
    logger.info("DB engine URL scheme: {}", url.split("://", 1)[0])

    if url.startswith("sqlite"):
        # SQLite: sin pool (un solo writer por archivo)
        return create_async_engine(
            url,
            echo=False,
            future=True,
        )

    # MySQL: pool explícito
    return create_async_engine(
        url,
        echo=False,
        future=True,
        poolclass=AsyncAdaptedQueuePool,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,   # <- crítico en Hostinger
        pool_recycle=1800,    # reciclar cada 30 min
    )


engine: AsyncEngine = _build_engine()
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Para uso fuera de FastAPI (scripts, seeders)."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
