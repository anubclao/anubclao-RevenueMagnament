"""
routers/ingest_log.py — GET /api/ingest-log

Audit log de los uploads de Excel. Append-only.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import IngestLog
from pydantic import BaseModel, ConfigDict
from datetime import datetime

router = APIRouter(prefix="/api/ingest-log", tags=["ingest-log"])


class IngestLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source_file: str
    sheet_name: str
    rows_inserted: int
    rows_updated: int
    rows_skipped: int
    uploaded_at: datetime


@router.get("", response_model=List[IngestLogOut])
async def list_ingest_log(
    limit: int = Query(default=20, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> List[IngestLogOut]:
    """Lista los uploads más recientes (auditoría)."""
    stmt = select(IngestLog).order_by(IngestLog.uploaded_at.desc()).limit(limit)
    rows = (await session.execute(stmt)).scalars().all()
    return [IngestLogOut.model_validate(r) for r in rows]
