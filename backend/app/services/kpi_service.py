"""
kpi_service.py — Cálculo de KPIs y series para el dashboard.

Todas las queries son async (SQLAlchemy 2.0) y respetan los filtros del usuario:
  - year, months[], start_date, end_date, channels[], scenario

Convención: cuando el filtro es None, no se aplica (no se filtra).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional, Sequence

from loguru import logger
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    Channel,
    ChannelSalesMonth,
    PickupWeekly,
    StlySale,
)
from ..schemas import (
    ChannelMixSlice,
    CurvaPickupPoint,
    DashboardCharts,
    DashboardFilters,
    KpiSummary,
    OccAdrPoint,
    PickupPoint,
)


MESES_ORDEN = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def _apply_month_filter(stmt, months: Optional[Sequence[str]]):
    if months:
        return stmt.where(PickupWeekly.mes.in_(list(months)))
    return stmt


def _coerce_float(x) -> float:
    if x is None:
        return 0.0
    if isinstance(x, Decimal):
        return float(x)
    return float(x)


# -----------------------------------------------------------------------------
# GET /api/dashboard/metrics
# -----------------------------------------------------------------------------
async def get_kpi_summary(
    session: AsyncSession, filters: DashboardFilters
) -> KpiSummary:
    """KPIs agregados según los filtros."""
    base = select(
        func.sum(PickupWeekly.ingresos).label("total_ingresos"),
        func.sum(PickupWeekly.rn_base + PickupWeekly.rn_pickup).label("rn_totales"),
        func.avg(PickupWeekly.occ_base_pct).label("occ_media"),
        func.sum(PickupWeekly.rn_pickup).label("rn_pickup_total"),
        func.sum(PickupWeekly.revenue_pickup).label("revenue_pickup_total"),
    )
    base = base.where(PickupWeekly.anio == filters.year) if filters.year else base
    base = _apply_month_filter(base, filters.months)
    if filters.start_date:
        base = base.where(PickupWeekly.fecha_reporte >= filters.start_date)
    if filters.end_date:
        base = base.where(PickupWeekly.fecha_reporte <= filters.end_date)

    row = (await session.execute(base)).one()

    # ADR promedio ponderado por RN: SUM(ingresos) / SUM(rn_total)
    ingresos = _coerce_float(row.total_ingresos)
    rn_totales = int(row.rn_totales or 0)
    rn_pickup_total = int(row.rn_pickup_total or 0)
    revenue_pickup_total = _coerce_float(row.revenue_pickup_total)
    occ_media = _coerce_float(row.occ_media)

    adr_promedio = (ingresos / rn_totales) if rn_totales > 0 else 0.0

    # Variación anual vs mismo período año anterior
    variacion_anual_pct: Optional[float] = None
    if filters.year and filters.year > 2020 and rn_totales > 0:
        prev_year = filters.year - 1
        prev = select(func.sum(PickupWeekly.ingresos))
        prev = prev.where(PickupWeekly.anio == prev_year)
        prev = _apply_month_filter(prev, filters.months)
        if filters.start_date and filters.end_date:
            # Comparar mismo rango del año anterior (shift -1y)
            prev = prev.where(
                and_(
                    PickupWeekly.fecha_reporte
                    >= date(filters.start_date.year - 1,
                            filters.start_date.month,
                            filters.start_date.day),
                    PickupWeekly.fecha_reporte
                    <= date(filters.end_date.year - 1,
                            filters.end_date.month,
                            filters.end_date.day),
                )
            )
        prev_ingresos = _coerce_float((await session.execute(prev)).scalar())
        if prev_ingresos > 0:
            variacion_anual_pct = round(
                (ingresos - prev_ingresos) / prev_ingresos * 100, 2
            )

    return KpiSummary(
        total_ingresos=Decimal(round(ingresos, 2)),
        adr_promedio=Decimal(round(adr_promedio, 2)),
        ocupacion_media_pct=Decimal(round(occ_media, 2)),
        rn_totales=rn_totales,
        rn_pickup_total=rn_pickup_total,
        revenue_pickup_total=Decimal(round(revenue_pickup_total, 2)),
        variacion_anual_pct=(
            Decimal(str(variacion_anual_pct)) if variacion_anual_pct is not None else None
        ),
        filtros_aplicados=filters,
    )


# -----------------------------------------------------------------------------
# GET /api/dashboard/charts
# -----------------------------------------------------------------------------
async def get_dashboard_charts(
    session: AsyncSession, filters: DashboardFilters
) -> DashboardCharts:
    occ_adr = await _get_occ_adr_series(session, filters)
    pickup = await _get_pickup_series(session, filters)
    mix = await _get_channel_mix(session, filters)
    curva = await _get_curva_pickup(session, filters)

    return DashboardCharts(
        occ_adr_series=occ_adr,
        pickup_series=pickup,
        channel_mix=mix,
        curva_pickup=curva,
        filtros_aplicados=filters,
    )


async def _get_occ_adr_series(
    session: AsyncSession, filters: DashboardFilters
) -> List[OccAdrPoint]:
    """Barras OCC/RN + línea ADR, agrupado por mes."""
    stmt = select(
        PickupWeekly.mes,
        func.avg(PickupWeekly.occ_base_pct).label("occ_media"),
        func.sum(PickupWeekly.ingresos).label("ingresos"),
        func.sum(PickupWeekly.rn_base + PickupWeekly.rn_pickup).label("rn"),
        func.avg(PickupWeekly.adr_base).label("adr"),
    ).group_by(PickupWeekly.mes)
    if filters.year:
        stmt = stmt.where(PickupWeekly.anio == filters.year)
    stmt = _apply_month_filter(stmt, filters.months)
    if filters.start_date:
        stmt = stmt.where(PickupWeekly.fecha_reporte >= filters.start_date)
    if filters.end_date:
        stmt = stmt.where(PickupWeekly.fecha_reporte <= filters.end_date)

    rows = (await session.execute(stmt)).all()
    by_mes = {r.mes: r for r in rows}

    # Mantener orden cronológico de los meses
    ordered = [m for m in MESES_ORDEN if m in by_mes]
    out: List[OccAdrPoint] = []
    for mes in ordered:
        r = by_mes[mes]
        ingresos = _coerce_float(r.ingresos)
        rn = int(r.rn or 0)
        adr = (ingresos / rn) if rn > 0 else 0.0
        out.append(OccAdrPoint(
            mes=mes,
            occ_pct=round(_coerce_float(r.occ_media), 2),
            adr=round(adr, 2),
            ingresos=round(ingresos, 2),
            rn=rn,
        ))
    return out


async def _get_pickup_series(
    session: AsyncSession, filters: DashboardFilters
) -> List[PickupPoint]:
    """Pickup por fecha_reporte."""
    stmt = select(
        PickupWeekly.fecha_reporte,
        PickupWeekly.rn_pickup,
        PickupWeekly.revenue_pickup,
        PickupWeekly.occ_pickup_pp,
    ).order_by(PickupWeekly.fecha_reporte.asc())
    if filters.year:
        stmt = stmt.where(PickupWeekly.anio == filters.year)
    stmt = _apply_month_filter(stmt, filters.months)
    if filters.start_date:
        stmt = stmt.where(PickupWeekly.fecha_reporte >= filters.start_date)
    if filters.end_date:
        stmt = stmt.where(PickupWeekly.fecha_reporte <= filters.end_date)

    rows = (await session.execute(stmt)).all()
    return [
        PickupPoint(
            fecha_reporte=r.fecha_reporte,
            rn_pickup=int(r.rn_pickup or 0),
            revenue_pickup=_coerce_float(r.revenue_pickup),
            occ_pickup_pp=_coerce_float(r.occ_pickup_pp),
        )
        for r in rows
    ]


async def _get_channel_mix(
    session: AsyncSession, filters: DashboardFilters
) -> List[ChannelMixSlice]:
    """Donut chart: participación de cada canal por revenue."""
    stmt = (
        select(
            Channel.name,
            Channel.category,
            func.sum(ChannelSalesMonth.revenue_total).label("rev"),
            func.sum(ChannelSalesMonth.rn_total).label("rn"),
        )
        .join(Channel, Channel.id == ChannelSalesMonth.channel_id)
        .group_by(Channel.id, Channel.name, Channel.category)
    )
    if filters.year:
        stmt = stmt.where(ChannelSalesMonth.anio == filters.year)
    if filters.months:
        stmt = stmt.where(ChannelSalesMonth.mes.in_(list(filters.months)))
    if filters.channels:
        stmt = stmt.where(Channel.name.in_(list(filters.channels)))

    rows = (await session.execute(stmt)).all()
    total_rev = sum(_coerce_float(r.rev) for r in rows) or 1.0

    out: List[ChannelMixSlice] = []
    for r in rows:
        rev = _coerce_float(r.rev)
        out.append(ChannelMixSlice(
            canal=r.name,
            categoria=r.category,
            rn=int(r.rn or 0),
            revenue=round(rev, 2),
            participacion_pct=round(rev / total_rev * 100, 2),
        ))
    out.sort(key=lambda x: x.revenue, reverse=True)
    return out


async def _get_curva_pickup(
    session: AsyncSession, filters: DashboardFilters
) -> List[CurvaPickupPoint]:
    """Compara RN del año actual vs STLY, semana a semana.

    Lógica: para cada (semana_num, fecha_semana) del año actual,
    agregamos RN por canal si hay filtro de canal, y comparamos con
    el mismo (semana_num) del año anterior de STLY.
    """
    if not filters.year:
        # Sin año no podemos comparar contra STLY.
        return []

    target_year = filters.year
    prev_year = target_year - 1

    # --- Año actual: pickup_weekly por fecha_reporte ---
    # Sumamos rn_base + rn_pickup (total actual) por semana.
    current = select(
        PickupWeekly.fecha_reporte,
        func.sum(PickupWeekly.rn_base + PickupWeekly.rn_pickup).label("rn_total"),
    ).where(PickupWeekly.anio == target_year).group_by(
        PickupWeekly.fecha_reporte
    ).order_by(PickupWeekly.fecha_reporte.asc())

    if filters.start_date:
        current = current.where(PickupWeekly.fecha_reporte >= filters.start_date)
    if filters.end_date:
        current = current.where(PickupWeekly.fecha_reporte <= filters.end_date)

    current_rows = (await session.execute(current)).all()
    current_by_week = {r.fecha_reporte.isocalendar()[1]: int(r.rn_total or 0)
                       for r in current_rows}

    # --- Año anterior: STLY por semana_num ---
    # Sumamos RN por semana_num (de la columna semana_num del STLY).
    # fecha_semana en STLY es la fecha del año actual; semana_num es el # de semana.
    # Pero STLY tiene registros para cada (año, mes), no por fecha_semana del año anterior.
    # Más simple: tomar el mes y asumir la semana_num del mes del año anterior.
    stly = select(
        StlySale.semana_num,
        func.sum(StlySale.rn).label("rn"),
    ).where(StlySale.anio_mes == prev_year).group_by(StlySale.semana_num)

    if filters.months:
        stly = stly.where(StlySale.mes.in_([f"{m} {prev_year}" for m in filters.months]))
    if filters.channels:
        stly = stly.join(Channel, Channel.id == StlySale.channel_id).where(
            Channel.name.in_(list(filters.channels))
        )

    stly_rows = (await session.execute(stly)).all()
    stly_by_week = {int(r.semana_num): int(r.rn or 0) for r in stly_rows}

    # --- Merge ---
    all_weeks = sorted(set(current_by_week.keys()) | set(stly_by_week.keys()))
    out: List[CurvaPickupPoint] = []
    for wk in all_weeks:
        rn_actual = current_by_week.get(wk, 0)
        rn_stly = stly_by_week.get(wk, 0)
        delta = ((rn_actual - rn_stly) / rn_stly * 100) if rn_stly > 0 else 0.0
        # fecha_semana aproximado: lunes de la semana wk del año target
        from datetime import date as _date
        try:
            fecha = _date.fromisocalendar(target_year, wk, 1)
        except ValueError:
            fecha = _date(target_year, 1, 1)
        out.append(CurvaPickupPoint(
            semana_num=wk,
            fecha_semana=fecha,
            rn_actual=rn_actual,
            rn_stly=rn_stly,
            delta_pct=round(delta, 2),
        ))
    return out
