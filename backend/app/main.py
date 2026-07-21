"""
main.py — FastAPI app entrypoint.

Run dev:
    uvicorn app.main:app --reload --port 8000

Run prod:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from sqlalchemy import text

from .config import settings
from .database import engine
from .routers import channels, channel_sales, dashboard, ingest_log, predictions, pickup, stly, upload
from .schemas import HealthOut


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("App arrancando | env={} | db={}", settings.app_env, settings.database_url.split("://", 1)[0])
    yield
    await engine.dispose()
    logger.info("App detenida")


app = FastAPI(
    title="Bora Bora — Revenue Management API",
    version="1.0.0",
    description="Backend para el dashboard de Revenue Management del Hotel Bora Bora.",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------
@app.get("/api/health", response_model=HealthOut, tags=["health"])
async def health() -> HealthOut:
    db_ok = True
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        logger.warning("Health check DB falló: {}", e)
        db_ok = False
    return HealthOut(
        status="ok" if db_ok else "degraded",
        db_ok=db_ok,
        db_url_scheme=settings.database_url.split("://", 1)[0],
    )


# -----------------------------------------------------------------------------
# Routers
# -----------------------------------------------------------------------------
app.include_router(upload.router)
app.include_router(dashboard.router)
app.include_router(pickup.router)
app.include_router(stly.router)
app.include_router(channels.router)
app.include_router(channel_sales.router)
app.include_router(ingest_log.router)
app.include_router(predictions.router)


# -----------------------------------------------------------------------------
# Root
# -----------------------------------------------------------------------------
@app.get("/", tags=["root"])
async def root() -> JSONResponse:
    return JSONResponse({
        "name": "Bora Bora RM API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    })
