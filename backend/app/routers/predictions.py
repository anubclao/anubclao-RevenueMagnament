"""
routers/predictions.py — GET /api/predictions

Genera proyecciones de Revenue Management a partir de los datos reales
(pickup_weekly + channel_sales_month). NO carga del Excel — son derivadas.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..services.predictions_service import generate_predictions

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


class PredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    mes: str
    anio: int
    scenario: str
    occ_pct: float
    adr: float
    rn: int
    rev: float


@router.get("", response_model=List[PredictionOut])
async def list_predictions(
    year: int = Query(..., ge=2020, le=2100, description="Año objetivo de la predicción"),
    scenarios: Optional[str] = Query(
        default=None,
        description="Escenarios separados por coma. Default: OPTIMIST,BASE,PESSIMIST",
    ),
    session: AsyncSession = Depends(get_session),
) -> List[PredictionOut]:
    """Devuelve 12 × N_escenarios predicciones."""
    if scenarios:
        scen_list = [s.strip().upper() for s in scenarios.split(",") if s.strip()]
    else:
        scen_list = ["OPTIMIST", "BASE", "PESSIMIST"]
    rows = await generate_predictions(session, year=year, scenarios=scen_list)
    return [PredictionOut(**r) for r in rows]
