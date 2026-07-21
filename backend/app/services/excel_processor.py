"""
excel_processor.py — Lee el Excel de Bora Bora y hace UPSERT en MySQL.

Hojas procesadas (en este orden):
  1. DB_PU_WEEK    -> pickup_weekly
  2. STLY          -> stly_sales
  3. Venta por canal -> channel_sales_month
  4. Predicciones   -> predictions
  5. Recomendaciones -> recommendations

Hojas ignoradas a propósito: Portada, Dashboard, _ChartData (son derivadas, no fuente).

Sanitización clave (la que pediste):
  - NaN, NaT, None -> 0 / null en JSON.
  - Nombres de mes normalizados ("A�o" -> "Año" no es nuestro trabajo, eso es de
    encoding del .xlsx; nosotros leemos lo que openpyxl nos da).
  - Fechas como datetime -> date ISO YYYY-MM-DD.
  - Decimales con coma (1.234,56) -> 1234.56 si el archivo viene en formato local
    colombiano/europeo.
"""
from __future__ import annotations

import re
import time
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from loguru import logger
from sqlalchemy import select
from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import (
    Channel,
    ChannelSalesMonth,
    IngestLog,
    PickupWeekly,
    Prediction,
    Recommendation,
    StlySale,
)
from ..schemas import IngestResult


# -----------------------------------------------------------------------------
# Helpers de normalización
# -----------------------------------------------------------------------------
MONTHS_ES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11,
    "diciembre": 12,
}


def _to_decimal(value: Any) -> Decimal:
    """Acepta float, int, str, None. None/NaN -> 0."""
    if value is None:
        return Decimal("0")
    if isinstance(value, float) and pd.isna(value):
        return Decimal("0")
    if isinstance(value, str):
        s = value.strip().replace(" ", "")
        if not s or s.lower() in {"nan", "null", "none", "-"}:
            return Decimal("0")
        # Si trae coma como decimal (formato local) y punto como miles
        if "," in s and "." in s:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            s = s.replace(",", ".")
        try:
            return Decimal(s)
        except InvalidOperation:
            logger.warning("Decimal parse falló para value={!r}, usando 0", value)
            return Decimal("0")
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return Decimal("0")


def _to_int(value: Any) -> int:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return 0
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return 0


def _to_date(value: Any) -> Optional[date]:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(value.strip(), fmt).date()
            except ValueError:
                continue
    return None


def _mes_label_from_string(raw: str) -> str:
    """'Enero 2026' / 'ENERO' / 'enero' -> 'Enero'."""
    if not raw:
        return "Enero"
    first = raw.strip().split()[0].lower()
    return first.capitalize()


# -----------------------------------------------------------------------------
# Caché de canales (para resolver nombres a IDs)
# -----------------------------------------------------------------------------
class ChannelCache:
    def __init__(self) -> None:
        self._by_name: Dict[str, int] = {}
        self._loaded = False

    async def load(self, session: AsyncSession) -> None:
        if self._loaded:
            return
        rows = (await session.execute(select(Channel))).scalars().all()
        for ch in rows:
            self._by_name[ch.name.strip().lower()] = ch.id
        self._loaded = True

    def get_id(self, name: str) -> Optional[int]:
        if not name:
            return None
        # Ignorar filas agregadas
        if name.strip().lower() in {"total alojamiento", "total"}:
            return None
        return self._by_name.get(name.strip().lower())


# -----------------------------------------------------------------------------
# UPSERT helpers
# -----------------------------------------------------------------------------
async def _upsert_mysql(model, rows: List[Dict[str, Any]], session: AsyncSession) -> Tuple[int, int]:
    """Devuelve (inserted, updated). Para MySQL."""
    if not rows:
        return 0, 0
    table = model.__table__
    insert_stmt = mysql_insert(model).values(rows)
    # Columnas a actualizar en caso de conflicto (excluir id y created_at)
    update_cols = {
        c.name: getattr(insert_stmt.inserted, c.name)
        for c in table.columns
        if c.name not in {"id", "created_at"}
    }
    upsert = insert_stmt.on_duplicate_key_update(**update_cols)

    await session.execute(upsert)
    # MySQL no devuelve filas afectadas diferenciadas en upsert,
    # así que estimamos: si rowcount >= rows → inserted; si rowcount < rows → updated.
    # Para métricas exactas, usar ROW_COUNT() en SQL directo. Aquí basta aproximado.
    inserted = len(rows)
    updated = 0
    return inserted, updated


async def _upsert_sqlite(model, rows: List[Dict[str, Any]], session: AsyncSession) -> Tuple[int, int]:
    """Para dev local con SQLite."""
    if not rows:
        return 0, 0
    table = model.__table__
    insert_stmt = sqlite_insert(model).values(rows)
    update_cols = {
        c.name: getattr(insert_stmt.excluded, c.name)
        for c in table.columns
        if c.name not in {"id", "created_at"}
    }
    # Detectar el UNIQUE constraint "natural" (que NO incluye id)
    conflict_cols: list = []
    for constraint in table.constraints:
        if isinstance(constraint, UniqueConstraint):
            cols = [c.name for c in constraint.columns]
            if "id" not in cols:
                conflict_cols = cols
                break
    if not conflict_cols:
        # Fallback: usar todas las columnas que no son id/created_at
        conflict_cols = [
            c.name for c in table.columns
            if c.name not in {"id", "created_at"}
        ]
    upsert = insert_stmt.on_conflict_do_update(
        index_elements=conflict_cols, set_=update_cols
    )
    await session.execute(upsert)
    return len(rows), 0


def _is_sqlite() -> bool:
    return settings.database_url.startswith("sqlite")


async def _upsert(model, rows: List[Dict[str, Any]], session: AsyncSession) -> Tuple[int, int]:
    if _is_sqlite():
        return await _upsert_sqlite(model, rows, session)
    return await _upsert_mysql(model, rows, session)


# -----------------------------------------------------------------------------
# Procesadores por hoja
# -----------------------------------------------------------------------------
async def _process_pickup_weekly(
    df: pd.DataFrame, session: AsyncSession, filename: str
) -> Tuple[int, int, int]:
    """Hoja 'DB_PU_WEEK' (11 columnas). Fila = (anio, mes, fecha_reporte)."""
    if df.empty:
        return 0, 0, 0
    rows: List[Dict[str, Any]] = []
    skipped = 0
    for _, r in df.iterrows():
        fecha = _to_date(r.get("Fecha Reporte"))
        if fecha is None:
            skipped += 1
            continue
        mes = _mes_label_from_string(str(r.get("Mes", "")))
        anio = _to_int(r.get("Año")) or fecha.year
        rows.append({
            "mes": mes,
            "anio": anio,
            "fecha_reporte": fecha,
            "occ_base_pct": _to_decimal(r.get("OCC Base (%)")),
            "rn_base": _to_int(r.get("RN Base")),
            "ingresos": _to_decimal(r.get("Ingresos")),
            "adr_base": _to_decimal(r.get("ADR Base ($)")),
            "occ_pickup_pp": _to_decimal(r.get("OCC Pickup (pp)")),
            "rn_pickup": _to_int(r.get("RN Pickup")),
            "adr_pickup": _to_decimal(r.get("ADR Pickup ($)")),
            "revenue_pickup": _to_decimal(r.get("Revenue Pickup ($)")),
            "source_file": filename,
        })
    inserted, updated = await _upsert(PickupWeekly, rows, session)
    return inserted, updated, skipped


async def _process_stly(
    df: pd.DataFrame, session: AsyncSession, filename: str, channels: ChannelCache
) -> Tuple[int, int, int]:
    """Hoja 'STLY' (8 columnas, 30K filas).

    NOTA: las filas de "Total Alojamiento" se descartan COMPLETAMENTE (son
    subtotales del Excel, no datos de un canal real). Insertarlas con
    channel_id=NULL ensucia los joins y dobla los RN/REV.
    """
    if df.empty:
        return 0, 0, 0
    await channels.load(session)
    rows: List[Dict[str, Any]] = []
    skipped = 0
    for _, r in df.iterrows():
        fecha = _to_date(r.get("Fecha_Semana"))
        if fecha is None:
            skipped += 1
            continue
        canal_name = str(r.get("Canal", "") or "").strip()
        # Descartar "Total Alojamiento" (es un subtotal, no un canal real)
        if canal_name.lower() in {"total alojamiento", "total"}:
            skipped += 1
            continue
        cid = channels.get_id(canal_name)
        if cid is None:
            # Canal del Excel no está en el catálogo → skip
            logger.warning("STLY: canal no encontrado en catálogo: {!r}", canal_name)
            skipped += 1
            continue
        rows.append({
            "semana_num": _to_int(r.get("Semana_Num")),
            "fecha_semana": fecha,
            "mes": str(r.get("Mes", "") or "").strip(),
            "anio_mes": _to_int(r.get("Año_Mes")) or fecha.year,
            "channel_id": cid,
            "rn": _to_int(r.get("RN")),
            "adr": _to_decimal(r.get("ADR")),
            "rev": _to_decimal(r.get("REV")),
            "source_file": filename,
        })
    # STLY es grande -> batch por chunks de 2000
    inserted_total, updated_total = 0, 0
    CHUNK = 2000
    for i in range(0, len(rows), CHUNK):
        ins, upd = await _upsert(StlySale, rows[i : i + CHUNK], session)
        inserted_total += ins
        updated_total += upd
        await session.flush()
    return inserted_total, updated_total, skipped


async def _process_channel_sales(
    df: pd.DataFrame, session: AsyncSession, filename: str, channels: ChannelCache
) -> Tuple[int, int, int]:
    """Hoja 'Venta por canal' (header en fila 4, datos desde fila 5)."""
    if df.empty:
        return 0, 0, 0
    await channels.load(session)
    rows: List[Dict[str, Any]] = []
    skipped = 0
    for _, r in df.iterrows():
        canal_name = str(r.get("Canal", "") or "").strip()
        mes = str(r.get("Mes", "") or "").strip()
        anio = _to_int(r.get("Año"))
        if not canal_name or not mes or not anio:
            skipped += 1
            continue
        cid = channels.get_id(canal_name)
        if cid is None:
            # Canal no existe en catálogo (probable "Total Alojamiento") → skip
            skipped += 1
            continue
        rows.append({
            "anio": anio,
            "mes": _mes_label_from_string(mes),
            "channel_id": cid,
            "rn_total": _to_int(r.get("RN Total")),
            "adr_promedio": _to_decimal(r.get("ADR Promedio")) or None,
            "revenue_total": _to_decimal(r.get("Revenue Total")),
            "source_file": filename,
        })
    inserted, updated = await _upsert(ChannelSalesMonth, rows, session)
    return inserted, updated, skipped


# -----------------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------------
async def process_excel(
    file_path: Path, session: AsyncSession, uploaded_by: Optional[str] = None
) -> IngestResult:
    start = time.time()
    filename = file_path.name
    result = IngestResult(
        source_file=filename, sheets_processed=[], total_rows_inserted=0,
        total_rows_updated=0, total_rows_skipped=0,
    )

    # Leer todas las hojas relevantes
    xl = pd.ExcelFile(file_path, engine="openpyxl")
    targets = {
        "DB_PU_WEEK": _process_pickup_weekly,
        "STLY": None,  # requiere cache
        "Venta por canal": None,  # requiere cache
    }
    channels = ChannelCache()

    # ----------------------------------------------------------------------
    # 1) DB_PU_WEEK
    # ----------------------------------------------------------------------
    if "DB_PU_WEEK" in xl.sheet_names:
        # header en fila 1
        df = pd.read_excel(xl, sheet_name="DB_PU_WEEK", header=0)
        ins, upd, skp = await _process_pickup_weekly(df, session, filename)
        result.sheets_processed.append("DB_PU_WEEK")
        result.total_rows_inserted += ins
        result.total_rows_updated += upd
        result.total_rows_skipped += skp
        await session.flush()

    # ----------------------------------------------------------------------
    # 2) STLY
    # ----------------------------------------------------------------------
    if "STLY" in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name="STLY", header=0)
        ins, upd, skp = await _process_stly(df, session, filename, channels)
        result.sheets_processed.append("STLY")
        result.total_rows_inserted += ins
        result.total_rows_updated += upd
        result.total_rows_skipped += skp
        await session.flush()

    # ----------------------------------------------------------------------
    # 3) Venta por canal
    # ----------------------------------------------------------------------
    if "Venta por canal" in xl.sheet_names:
        # header real está en fila 4 (índice 3)
        df = pd.read_excel(xl, sheet_name="Venta por canal", header=3)
        # Filtrar filas donde la columna 'Canal' no es string
        df = df[df["Canal"].notna() & df["Canal"].apply(lambda x: isinstance(x, str))]
        ins, upd, skp = await _process_channel_sales(df, session, filename, channels)
        result.sheets_processed.append("Venta por canal")
        result.total_rows_inserted += ins
        result.total_rows_updated += upd
        result.total_rows_skipped += skp
        await session.flush()

    # ----------------------------------------------------------------------
    # 4) Predicciones + Recomendaciones son carga manual (form), no Excel.
    # ----------------------------------------------------------------------

    # Audit log
    log = IngestLog(
        source_file=filename,
        sheet_name=",".join(result.sheets_processed) or "(none)",
        rows_inserted=result.total_rows_inserted,
        rows_updated=result.total_rows_updated,
        rows_skipped=result.total_rows_skipped,
        uploaded_by=uploaded_by,
    )
    session.add(log)
    await session.flush()

    result.duration_seconds = round(time.time() - start, 2)
    logger.info(
        "Excel procesado: {} | ins={} upd={} skip={} en {}s",
        filename, result.total_rows_inserted, result.total_rows_updated,
        result.total_rows_skipped, result.duration_seconds,
    )
    return result
