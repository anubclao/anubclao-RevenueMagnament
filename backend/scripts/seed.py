"""
seed.py — Inicializa la DB con las tablas y el catálogo de canales.

Uso:
    python -m scripts.seed
"""
from __future__ import annotations

import asyncio
from pathlib import Path

from loguru import logger
from sqlalchemy import select

from app.database import engine, session_scope
from app.models import Base, Channel


# Catálogo de canales (debe coincidir con docs/architecture.md §2)
CHANNELS = [
    ("Sitio web o motor de reservas",     "DIRECT",    10),
    ("Muelle Bora Bora",                   "DIRECT",    11),
    ("Friends & Family",                   "DIRECT",    12),
    ("Sin reserva previa",                 "DIRECT",    13),
    ("Instagram",                          "DIRECT",    14),
    ("BotMaker",                           "DIRECT",    15),
    ("BotMaker/ Instagram",                "DIRECT",    16),
    ("Correo Electrónico",                 "DIRECT",    17),
    ("Teléfono",                           "DIRECT",    18),
    ("Crisp desde abril",                  "DIRECT",    19),
    ("Zenvia",                             "DIRECT",    20),
    ("Zenvia/ Crisp desde abril",          "DIRECT",    21),
    ("Booking.com",                        "OTA",       20),
    ("Expedia",                            "OTA",       21),
    ("Airbnb (API)",                       "OTA",       22),
    ("TripAdvisor - Eliminar",             "OTA",       23),
    ("OTA",                                "OTA",       24),
    ("OTA Predeterminada",                 "OTA",       25),
    ("Agencia de viajes",                  "WHOLESALER", 30),
    ("Agencia de viajes por defecto",      "WHOLESALER", 31),
    ("Mayorista",                          "WHOLESALER", 32),
    ("Mayorista por defecto",              "WHOLESALER", 33),
    ("Cliente corporativo",                "CORPORATE", 40),
    ("Cliente corporativo predeterminado", "CORPORATE", 41),
    ("Total Alojamiento",                  "OTHER",     999),
]


async def main() -> None:
    # 1) Crear todas las tablas
    logger.info("Creando esquema...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Esquema listo.")

    # 2) Sembrar canales (idempotente)
    async with session_scope() as session:
        for name, category, sort_order in CHANNELS:
            existing = (await session.execute(
                select(Channel).where(Channel.name == name)
            )).scalar_one_or_none()
            if existing:
                existing.category = category
                existing.sort_order = sort_order
                existing.is_active = True
            else:
                session.add(Channel(
                    name=name,
                    display_name=name,
                    category=category,
                    sort_order=sort_order,
                ))
    logger.info(f"Sembrados {len(CHANNELS)} canales.")

    await engine.dispose()
    logger.info("Seed completo.")


if __name__ == "__main__":
    asyncio.run(main())
