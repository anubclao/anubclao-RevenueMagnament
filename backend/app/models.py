"""
models.py — SQLAlchemy 2.0 typed models para Bora Bora RM.
Versión ejecutable (la versión documentada está en docs/architecture.md §3).

NOTA: usamos Integer (no BigInteger) para los PKs porque SQLite NO auto-incrementa
BIGINT PRIMARY KEY (solo INTEGER PRIMARY KEY). En MySQL ambos funcionan.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Integer, Boolean, Date, DateTime, Enum, ForeignKey,
    Numeric, SmallInteger, String, Text, UniqueConstraint, Index, func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Channel(Base):
    __tablename__ = "channels"
    __table_args__ = (UniqueConstraint("name", name="uk_channels_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(
        Enum("DIRECT", "OTA", "WHOLESALER", "CORPORATE", "OTHER",
             name="channel_category"),
        nullable=False, default="OTHER",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=999)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )


class PickupWeekly(Base):
    __tablename__ = "pickup_weekly"
    __table_args__ = (
        UniqueConstraint("anio", "mes", "fecha_reporte", name="uk_pickup_nat"),
        Index("idx_pickup_anio_mes", "anio", "mes"),
        Index("idx_pickup_fecha", "fecha_reporte"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mes: Mapped[str] = mapped_column(String(20), nullable=False)
    anio: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    fecha_reporte: Mapped[date] = mapped_column(Date, nullable=False)
    occ_base_pct: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    rn_base: Mapped[int] = mapped_column(Integer, nullable=False)
    ingresos: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    adr_base: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    occ_pickup_pp: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, default=Decimal("0.00")
    )
    rn_pickup: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    adr_pickup: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    revenue_pickup: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=Decimal("0.00")
    )
    source_file: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )


class StlySale(Base):
    __tablename__ = "stly_sales"
    __table_args__ = (
        UniqueConstraint(
            "fecha_semana", "anio_mes", "mes", "channel_id", name="uk_stly_nat"
        ),
        Index("idx_stly_fecha", "fecha_semana"),
        Index("idx_stly_anio_mes_canal", "anio_mes", "mes", "channel_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    semana_num: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    fecha_semana: Mapped[date] = mapped_column(Date, nullable=False)
    mes: Mapped[str] = mapped_column(String(20), nullable=False)
    anio_mes: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    channel_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("channels.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    channel: Mapped[Optional["Channel"]] = relationship(lazy="joined")
    rn: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    adr: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )
    rev: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=Decimal("0.00")
    )
    source_file: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )


class ChannelSalesMonth(Base):
    __tablename__ = "channel_sales_month"
    __table_args__ = (
        UniqueConstraint("anio", "mes", "channel_id", name="uk_csm_nat"),
        Index("idx_csm_anio_mes", "anio", "mes"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    anio: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    mes: Mapped[str] = mapped_column(String(20), nullable=False)
    channel_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("channels.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    channel: Mapped["Channel"] = relationship(lazy="joined")
    rn_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    adr_promedio: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    revenue_total: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=Decimal("0.00")
    )
    source_file: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (
        UniqueConstraint("anio", "mes", "scenario", "metric_type", name="uk_pred_nat"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    anio: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    mes: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    scenario: Mapped[str] = mapped_column(
        Enum("OPTIMIST", "BASE", "PESSIMIST", name="scenario"),
        nullable=False,
    )
    metric_type: Mapped[str] = mapped_column(
        Enum("OCC", "ADR", "REV", "RN", name="metric_type"),
        nullable=False,
    )
    value: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )


class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        Index("idx_rec_fecha", "fecha"),
        Index("idx_rec_estado", "estado"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    categoria: Mapped[str] = mapped_column(String(50), nullable=False)
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    prioridad: Mapped[str] = mapped_column(
        Enum("ALTA", "MEDIA", "BAJA", name="prioridad"),
        nullable=False, default="MEDIA",
    )
    estado: Mapped[str] = mapped_column(
        Enum("PENDIENTE", "EN_CURSO", "COMPLETADA", name="estado"),
        nullable=False, default="PENDIENTE",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )


class IngestLog(Base):
    __tablename__ = "ingest_log"
    __table_args__ = (Index("idx_ingest_at", "uploaded_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_file: Mapped[str] = mapped_column(String(255), nullable=False)
    sheet_name: Mapped[str] = mapped_column(String(80), nullable=False)
    rows_inserted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rows_updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rows_skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )

