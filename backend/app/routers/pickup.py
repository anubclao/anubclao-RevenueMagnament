"""
routers/pickup.py — POST /api/pickup, GET /api/pickup
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import PickupWeekly
from ..schemas import PickupWeeklyCreate, PickupWeeklyOut

router = APIRouter(prefix="/api/pickup", tags=["pickup"])


@router.post("", response_model=PickupWeeklyOut, status_code=201)
async def create_or_update_pickup(
    payload: PickupWeeklyCreate,
    session: AsyncSession = Depends(get_session),
) -> PickupWeeklyOut:
    """Inserta o actualiza un registro de pickup (UPSERT por natural key)."""
    # Buscar existente por (anio, mes, fecha_reporte)
    stmt = select(PickupWeekly).where(
        PickupWeekly.anio == payload.anio,
        PickupWeekly.mes == payload.mes,
        PickupWeekly.fecha_reporte == payload.fecha_reporte,
    )
    existing = (await session.execute(stmt)).scalar_one_or_none()

    if existing:
        for field, value in payload.model_dump().items():
            setattr(existing, field, value)
        await session.flush()
        await session.refresh(existing)
        return PickupWeeklyOut.model_validate(existing)

    obj = PickupWeekly(**payload.model_dump())
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return PickupWeeklyOut.model_validate(obj)


@router.get("", response_model=List[PickupWeeklyOut])
async def list_pickup(
    year: Optional[int] = Query(default=None, ge=2020, le=2100),
    mes: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=2000),
    session: AsyncSession = Depends(get_session),
) -> List[PickupWeeklyOut]:
    stmt = select(PickupWeekly).order_by(PickupWeekly.fecha_reporte.desc()).limit(limit)
    if year:
        stmt = stmt.where(PickupWeekly.anio == year)
    if mes:
        stmt = stmt.where(PickupWeekly.mes == mes)
    rows = (await session.execute(stmt)).scalars().all()
    return [PickupWeeklyOut.model_validate(r) for r in rows]
