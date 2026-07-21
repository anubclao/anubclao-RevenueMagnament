"""
routers/dashboard.py — GET /api/dashboard/metrics, /api/dashboard/charts
"""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..schemas import DashboardCharts, DashboardFilters, KpiSummary
from ..services.kpi_service import get_dashboard_charts, get_kpi_summary

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _parse_filters(
    year: Optional[int],
    months: Optional[List[str]],
    start_date: Optional[date],
    end_date: Optional[date],
    channels: Optional[List[str]],
    scenario: Optional[str],
) -> DashboardFilters:
    return DashboardFilters(
        year=year,
        months=months or None,
        start_date=start_date,
        end_date=end_date,
        channels=channels or None,
        scenario=scenario,
    )


@router.get("/metrics", response_model=KpiSummary)
async def get_metrics(
    year: Optional[int] = Query(default=None, ge=2020, le=2100),
    months: Optional[List[str]] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    channels: Optional[List[str]] = Query(default=None),
    scenario: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> KpiSummary:
    """KPIs resumidos. Query params: ?year=2026&months=Enero&months=Febrero&..."""
    filters = _parse_filters(year, months, start_date, end_date, channels, scenario)
    return await get_kpi_summary(session, filters)


@router.get("/charts", response_model=DashboardCharts)
async def get_charts(
    year: Optional[int] = Query(default=None, ge=2020, le=2100),
    months: Optional[List[str]] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    channels: Optional[List[str]] = Query(default=None),
    scenario: Optional[str] = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> DashboardCharts:
    """Datos para los 4 charts del dashboard."""
    filters = _parse_filters(year, months, start_date, end_date, channels, scenario)
    return await get_dashboard_charts(session, filters)
