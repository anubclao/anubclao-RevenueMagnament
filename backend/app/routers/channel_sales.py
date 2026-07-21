"""
routers/channel_sales.py — GET /api/channel-sales

Lista la venta mensual por canal (hoja "Venta por canal" del Excel).
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Channel, ChannelSalesMonth

router = APIRouter(prefix="/api/channel-sales", tags=["channel-sales"])


class ChannelSalesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    anio: int
    mes: str
    channel_id: int
    rn_total: int
    adr_promedio: float | None
    revenue_total: float
    channel_name: str | None = None
    channel_category: str | None = None


@router.get("", response_model=List[ChannelSalesOut])
async def list_channel_sales(
    year: Optional[int] = Query(default=None, ge=2020, le=2100),
    mes: Optional[str] = Query(default=None),
    channel_id: Optional[int] = Query(default=None, ge=1),
    limit: int = Query(default=500, ge=1, le=5000),
    session: AsyncSession = Depends(get_session),
) -> List[ChannelSalesOut]:
    """Lista ventas mensuales por canal. Soporta filtros por año, mes y canal."""
    stmt = (
        select(ChannelSalesMonth, Channel.name, Channel.category)
        .join(Channel, Channel.id == ChannelSalesMonth.channel_id)
        .order_by(
            ChannelSalesMonth.anio.desc(),
            ChannelSalesMonth.mes,
            Channel.sort_order,
        )
        .limit(limit)
    )
    if year:
        stmt = stmt.where(ChannelSalesMonth.anio == year)
    if mes:
        stmt = stmt.where(ChannelSalesMonth.mes == mes)
    if channel_id:
        stmt = stmt.where(ChannelSalesMonth.channel_id == channel_id)
    rows = (await session.execute(stmt)).all()

    out: List[ChannelSalesOut] = []
    for row in rows:
        csm, ch_name, ch_cat = row
        out.append(ChannelSalesOut(
            id=csm.id,
            anio=csm.anio,
            mes=csm.mes,
            channel_id=csm.channel_id,
            rn_total=csm.rn_total,
            adr_promedio=float(csm.adr_promedio) if csm.adr_promedio is not None else None,
            revenue_total=float(csm.revenue_total),
            channel_name=ch_name,
            channel_category=ch_cat,
        ))
    return out
