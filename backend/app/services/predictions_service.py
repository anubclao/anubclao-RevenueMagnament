"""
predictions_service.py — Genera proyecciones de Revenue Management a partir
de los datos reales (no del Excel). Tres escenarios:

  - OPTIMIST  = promedio histórico * 1.10
  - BASE      = promedio histórico (ponderado por recencia)
  - PESSIMIST = promedio histórico * 0.90

Lógica:
  1. Por cada mes del año objetivo (ej: 2026), agregamos pickup_weekly del
     último reporte (snapshot base = occ_base_pct, rn_base, adr_base, ingresos).
  2. Calculamos tendencia mensual: comparamos el mes con su mismo mes del año
     anterior en channel_sales_month (RN Total, ADR Promedio).
  3. Aplicamos los multiplicadores de escenario sobre la base.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import List, Optional

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ChannelSalesMonth, PickupWeekly


MESES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

SCENARIO_MULT = {
    "OPTIMIST": Decimal("1.10"),
    "BASE": Decimal("1.00"),
    "PESSIMIST": Decimal("0.90"),
}


@dataclass
class MonthlyBase:
    """Snapshot base (último reporte) por mes del año objetivo."""
    mes: str
    occ_pct: Decimal
    adr: Decimal
    rn: int
    ingresos: Decimal


@dataclass
class PredictionPoint:
    mes: str
    scenario: str
    occ_pct: Decimal
    adr: Decimal
    rn: int
    rev: Decimal


async def _get_monthly_base(session: AsyncSession, year: int) -> List[MonthlyBase]:
    """Para cada mes, toma el ÚLTIMO reporte de pickup_weekly del año (snapshot final)."""
    # Subquery: max(fecha_reporte) por (mes, anio)
    sub = (
        select(
            PickupWeekly.mes.label("mes"),
            func.max(PickupWeekly.fecha_reporte).label("max_fecha"),
        )
        .where(PickupWeekly.anio == year)
        .group_by(PickupWeekly.mes)
        .subquery()
    )
    stmt = (
        select(
            PickupWeekly.mes,
            PickupWeekly.occ_base_pct,
            PickupWeekly.adr_base,
            PickupWeekly.rn_base,
            PickupWeekly.ingresos,
        )
        .join(
            sub,
            (PickupWeekly.mes == sub.c.mes)
            & (PickupWeekly.fecha_reporte == sub.c.max_fecha),
        )
        .where(PickupWeekly.anio == year)
    )
    rows = (await session.execute(stmt)).all()

    by_mes = {r[0]: MonthlyBase(mes=r[0], occ_pct=r[1], adr=r[2], rn=r[3], ingresos=r[4]) for r in rows}

    # Asegurar 12 meses (rellenar con 0 si faltan)
    out: List[MonthlyBase] = []
    for m in MESES_ES:
        out.append(by_mes.get(m, MonthlyBase(mes=m, occ_pct=Decimal("0"), adr=Decimal("0"), rn=0, ingresos=Decimal("0"))))
    return out


async def _get_historical_trend(
    session: AsyncSession, year: int, mes: str
) -> tuple[Decimal, Decimal, int]:
    """Compara (mes, year-1) con (mes, year-2) en channel_sales_month.

    Devuelve (occ_delta_pct, adr_delta_pct, rn_delta_pct) — p.ej. 0.05 = +5%.
    Si no hay histórico, devuelve (0, 0, 0) = sin cambio.
    """
    # Buscar (mes, year-1) y (mes, year-2)
    stmt_prev1 = (
        select(
            func.avg(ChannelSalesMonth.adr_promedio),
            func.sum(ChannelSalesMonth.rn_total),
        )
        .where(ChannelSalesMonth.anio == year - 1)
        .where(ChannelSalesMonth.mes == mes)
    )
    stmt_prev2 = (
        select(
            func.avg(ChannelSalesMonth.adr_promedio),
            func.sum(ChannelSalesMonth.rn_total),
        )
        .where(ChannelSalesMonth.anio == year - 2)
        .where(ChannelSalesMonth.mes == mes)
    )
    r1 = (await session.execute(stmt_prev1)).one()
    r2 = (await session.execute(stmt_prev2)).one()

    # Si no hay histórico, sin cambio
    if r1[0] is None or r2[0] is None:
        return Decimal("0"), Decimal("0"), Decimal("0")

    adr_p1, rn_p1 = r1
    adr_p2, rn_p2 = r2
    if adr_p2 == 0 or rn_p2 == 0:
        return Decimal("0"), Decimal("0"), Decimal("0")

    adr_delta = (Decimal(str(adr_p1)) - Decimal(str(adr_p2))) / Decimal(str(adr_p2))
    rn_delta = (Decimal(str(rn_p1)) - Decimal(str(rn_p2))) / Decimal(str(rn_p2))
    return Decimal("0"), adr_delta, rn_delta  # OCC delta lo omitimos (no hay histórico)


async def generate_predictions(
    session: AsyncSession,
    year: int,
    scenarios: Optional[List[str]] = None,
) -> List[dict]:
    """Genera las predicciones para los 12 meses del año, en cada escenario."""
    if scenarios is None:
        scenarios = ["OPTIMIST", "BASE", "PESSIMIST"]

    base = await _get_monthly_base(session, year)
    out: List[dict] = []

    for mb in base:
        _, adr_trend, rn_trend = await _get_historical_trend(session, year, mb.mes)
        for scen in scenarios:
            mult = SCENARIO_MULT.get(scen, Decimal("1.0"))
            adr = mb.adr * (Decimal("1") + adr_trend) * mult
            rn = int(Decimal(mb.rn) * (Decimal("1") + rn_trend) * mult)
            rev = adr * Decimal(rn)
            out.append({
                "mes": mb.mes,
                "anio": year,
                "scenario": scen,
                "occ_pct": float(mb.occ_pct),
                "adr": float(adr.quantize(Decimal("0.01"))),
                "rn": rn,
                "rev": float(rev.quantize(Decimal("0.01"))),
            })
    logger.info("Generadas {} predicciones para año {} ({} escenarios)", len(out), year, len(scenarios))
    return out
