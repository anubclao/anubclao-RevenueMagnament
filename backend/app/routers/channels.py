"""
routers/channels.py — GET /api/channels

Catálogo de canales (Booking.com, Sitio web, OTA, etc.) usado por:
  - el filtro de canales del dashboard
  - el form de pickup (muestra nombres legibles)
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Channel
from ..schemas import ChannelOut

router = APIRouter(prefix="/api/channels", tags=["channels"])


@router.get("", response_model=List[ChannelOut])
async def list_channels(
    active_only: bool = Query(default=True),
    category: Optional[str] = Query(default=None, pattern="^(DIRECT|OTA|WHOLESALER|CORPORATE|OTHER)$"),
    session: AsyncSession = Depends(get_session),
) -> List[ChannelOut]:
    """Lista el catálogo de canales ordenado por sort_order."""
    stmt = select(Channel).order_by(Channel.sort_order, Channel.name)
    if active_only:
        stmt = stmt.where(Channel.is_active.is_(True))
    if category:
        stmt = stmt.where(Channel.category == category)
    rows = (await session.execute(stmt)).scalars().all()
    return [ChannelOut.model_validate(c) for c in rows]
