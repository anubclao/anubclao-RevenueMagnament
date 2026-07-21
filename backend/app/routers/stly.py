"""
routers/stly.py — POST /api/stly, GET /api/stly
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import StlySale
from ..schemas import StlyCreate, StlyOut

router = APIRouter(prefix="/api/stly", tags=["stly"])


@router.post("", response_model=StlyOut, status_code=201)
async def create_or_update_stly(
    payload: StlyCreate,
    session: AsyncSession = Depends(get_session),
) -> StlyOut:
    stmt = select(StlySale).where(
        StlySale.fecha_semana == payload.fecha_semana,
        StlySale.anio_mes == payload.anio_mes,
        StlySale.mes == payload.mes,
        StlySale.channel_id == payload.channel_id,
    )
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing:
        for f, v in payload.model_dump().items():
            setattr(existing, f, v)
        await session.flush()
        await session.refresh(existing)
        return StlyOut.model_validate(existing)

    obj = StlySale(**payload.model_dump())
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return StlyOut.model_validate(obj)


@router.get("", response_model=List[StlyOut])
async def list_stly(
    year: Optional[int] = Query(default=None, ge=2020, le=2100),
    mes: Optional[str] = Query(default=None),
    channel_id: Optional[int] = Query(default=None),
    limit: int = Query(default=500, ge=1, le=10000),
    session: AsyncSession = Depends(get_session),
) -> List[StlyOut]:
    stmt = select(StlySale).order_by(StlySale.fecha_semana.desc()).limit(limit)
    if year:
        stmt = stmt.where(StlySale.anio_mes == year)
    if mes:
        stmt = stmt.where(StlySale.mes == mes)
    if channel_id:
        stmt = stmt.where(StlySale.channel_id == channel_id)
    rows = (await session.execute(stmt)).scalars().all()
    return [StlyOut.model_validate(r) for r in rows]
