"""
schemas.py — Pydantic v2 schemas (request/response).

Convención: response schemas tienen `model_config = ConfigDict(from_attributes=True)`
para poder construirlos desde ORM con `Model.model_validate(obj)`.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# -----------------------------------------------------------------------------
# Catálogo
# -----------------------------------------------------------------------------
class ChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    display_name: str
    category: str
    is_active: bool
    sort_order: int


# -----------------------------------------------------------------------------
# Pickup Weekly (DB_PU_WEEK)
# -----------------------------------------------------------------------------
class PickupWeeklyCreate(BaseModel):
    """Para POST /api/pickup (formulario manual)."""
    mes: str = Field(..., min_length=3, max_length=20, examples=["Enero"])
    anio: int = Field(..., ge=2020, le=2100, examples=[2026])
    fecha_reporte: date
    occ_base_pct: Decimal = Field(..., ge=0, le=100, examples=[71.51])
    rn_base: int = Field(..., ge=0, examples=[133])
    ingresos: Decimal = Field(..., ge=0, examples=[217813377.35])
    adr_base: Decimal = Field(..., ge=0, examples=[1637694.57])
    occ_pickup_pp: Decimal = Field(default=Decimal("0.00"), ge=-100, le=100)
    rn_pickup: int = Field(default=0)
    adr_pickup: Decimal = Field(default=Decimal("0.00"))
    revenue_pickup: Decimal = Field(default=Decimal("0.00"))

    @field_validator("mes")
    @classmethod
    def _validate_mes(cls, v: str) -> str:
        allowed = {
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
        }
        # Aceptar también "Enero 2026" por si el form lo manda concatenado
        v_clean = v.split()[0].capitalize()
        if v_clean not in allowed:
            raise ValueError(f"mes debe ser uno de {sorted(allowed)}")
        return v_clean


class PickupWeeklyOut(PickupWeeklyCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source_file: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# -----------------------------------------------------------------------------
# STLY
# -----------------------------------------------------------------------------
class StlyCreate(BaseModel):
    # semana_num puede ser hasta 120+ (semana del año + offset multi-año en datos históricos)
    semana_num: int = Field(..., ge=1, le=200)
    fecha_semana: date
    mes: str = Field(..., examples=["Enero 2024"])
    anio_mes: int = Field(..., ge=2020, le=2100)
    channel_id: Optional[int] = None
    rn: int = Field(default=0, ge=0)
    adr: Decimal = Field(default=Decimal("0.00"), ge=0)
    rev: Decimal = Field(default=Decimal("0.00"), ge=0)


class StlyOut(StlyCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    # No exponemos `channel` (relationship) aquí — el frontend resuelve el nombre
    # del canal via /api/channels y el dashboard ya hace el join en kpi_service.


# -----------------------------------------------------------------------------
# Filtros del Dashboard
# -----------------------------------------------------------------------------
class DashboardFilters(BaseModel):
    """Query params que acepta GET /api/dashboard/metrics y /api/dashboard/charts."""
    year: Optional[int] = Field(default=None, ge=2020, le=2100)
    months: Optional[List[str]] = Field(default=None)  # ["Enero","Febrero"]
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    channels: Optional[List[str]] = Field(default=None)  # nombres de canal
    scenario: Optional[str] = Field(default=None, pattern="^(OPTIMIST|BASE|PESSIMIST)$")


# -----------------------------------------------------------------------------
# KPIs del dashboard
# -----------------------------------------------------------------------------
class KpiSummary(BaseModel):
    """Lo que retorna GET /api/dashboard/metrics."""
    total_ingresos: Decimal
    adr_promedio: Decimal
    ocupacion_media_pct: Decimal
    rn_totales: int
    rn_pickup_total: int
    revenue_pickup_total: Decimal
    variacion_anual_pct: Optional[Decimal] = None  # vs mismo período año anterior
    filtros_aplicados: DashboardFilters


# -----------------------------------------------------------------------------
# Charts (data cruda lista para Recharts)
# -----------------------------------------------------------------------------
class OccAdrPoint(BaseModel):
    """Para gráfico combinado OCC vs ADR por mes."""
    mes: str
    occ_pct: float
    adr: float
    ingresos: float
    rn: int


class PickupPoint(BaseModel):
    """Para gráfico de análisis de pickup por fecha_reporte."""
    fecha_reporte: date
    rn_pickup: int
    revenue_pickup: float
    occ_pickup_pp: float


class ChannelMixSlice(BaseModel):
    """Para donut chart de mix de canales."""
    canal: str
    categoria: str
    rn: int
    revenue: float
    participacion_pct: float


class CurvaPickupPoint(BaseModel):
    """Para curva de pickup (año actual vs STLY)."""
    semana_num: int
    fecha_semana: date
    rn_actual: int
    rn_stly: int
    delta_pct: float


class DashboardCharts(BaseModel):
    occ_adr_series: List[OccAdrPoint]
    pickup_series: List[PickupPoint]
    channel_mix: List[ChannelMixSlice]
    curva_pickup: List[CurvaPickupPoint]
    filtros_aplicados: DashboardFilters


# -----------------------------------------------------------------------------
# Upload
# -----------------------------------------------------------------------------
class IngestResult(BaseModel):
    source_file: str
    sheets_processed: List[str]
    total_rows_inserted: int
    total_rows_updated: int
    total_rows_skipped: int
    errors: List[str] = Field(default_factory=list)
    duration_seconds: float = 0.0


# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------
class HealthOut(BaseModel):
    status: str
    db_ok: bool
    db_url_scheme: str
    version: str = "1.0.0"
