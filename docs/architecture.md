# BORA BORA — Arquitectura de Datos (MySQL + SQLAlchemy)

> **Hotel Bora Bora** · Revenue Management · Moneda: **COP** (no USD, ver `docs/decisions.md` §1)
> **Stack objetivo:** Python/FastAPI + Pandas + SQLAlchemy 2.0 + MySQL 8 (Hostinger)
> **Plan B si decides pasar todo a Next.js nativo (recomendado):** mismo esquema, Prisma en lugar de SQLAlchemy.

---

## 1. Modelo de Datos — Vista General

El Excel de Bora Bora tiene 8 hojas relevantes. Las modelamos como **5 tablas normalizadas** + 1 catálogo + 1 tabla de auditoría:

```
┌──────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   channels   │◄─────┤  pickup_weekly   │      │channel_sales_month│
│  (catálogo)  │      │   (DB_PU_WEEK)   │      │ (Venta por canal)│
└──────┬───────┘      └──────────────────┘      └────────┬─────────┘
       │                                                 │
       │                                                 │
       ▼                                                 ▼
┌──────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  stly_sales  │      │   predictions    │      │ recommendations  │
│  (STLY)      │      │  (Predicciones)  │      │(Recomendaciones) │
└──────────────┘      └──────────────────┘      └──────────────────┘
```

### Decisiones de diseño (resumen ejecutivo)

| Decisión | Por qué |
|---|---|
| **Catálogo `channels`** (24 canales pre-poblados) | `STLY` y `Venta por canal` repiten el nombre del canal como string libre. Sin FK, los typos ("Booking" vs "Booking.com") duplican métricas. |
| **`DECIMAL(15,2)` para dinero, no `FLOAT`** | Los ADRs son ~1.5M COP con 2 decimales. `FLOAT` introduce error de redondeo (1.50000001 ≠ 1.5). Un SQL `SUM()` sobre FLOAT puede dar 0.01 de diferencia acumulada. |
| **`DATE` para fechas, no `DATETIME`** | Ninguna hoja tiene hora. `DATETIME` ocupa 8 bytes vs 3 de `DATE` y confunde al frontend al hacer `new Date()` con TZ. |
| **`SMALLINT UNSIGNED` para año** | Rango 0–65535, ocupa 2 bytes. El hotel no va a operar hasta el año 65535. |
| **Surrogate keys `BIGINT AUTO_INCREMENT` + UNIQUE constraint natural** | Permite UPSERT idempotente (`ON DUPLICATE KEY UPDATE`) sin pelearse con IDs reusados. |
| **Tabla `ingest_log`** | Auditoría de cada upload Excel: quién, cuándo, cuántas filas insertadas vs actualizadas vs rechazadas. Sin esto, depurar "por qué el KPI cambió" se vuelve arqueología. |
| **`utf8mb4` + collation `utf8mb4_unicode_ci`** | El Excel tiene acentos raros en headers ("A�o", "Tel�fono") y nombres propios con tildes. `utf8mb4` cubre emoji y tildes latinas. |
| **No FKs entre `pickup_weekly` y `channels`** | `DB_PU_WEEK` no tiene canal — es pickup agregado por semana. Las FKs donde no hay relación natural solo cuestan rendimiento en MyISAM/InnoDB. |

---

## 2. DDL — Script `init.sql` (ejecutable en Hostinger hPanel → MySQL)

```sql
-- ===========================================================================
-- BORA BORA — Inicialización de esquema
-- Ejecutar en: Hostinger hPanel → Bases de datos MySQL → phpMyAdmin → SQL
-- Charset: utf8mb4 (importante: NO latin1, los tildes se rompen)
-- ===========================================================================

CREATE DATABASE IF NOT EXISTS bora_bora_rm
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE bora_bora_rm;

-- ----------------------------------------------------------------------------
-- 1. channels — catálogo normalizado de canales
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channels (
  id              SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(80)  NOT NULL,                       -- "Booking.com"
  display_name    VARCHAR(120) NOT NULL,                       -- "Booking.com (PMS)"
  category        ENUM('DIRECT','OTA','WHOLESALER','CORPORATE','OTHER')
                  NOT NULL DEFAULT 'OTHER',
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order      SMALLINT UNSIGNED NOT NULL DEFAULT 999,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_channels_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pre-poblar con los 24 canales del Excel STLY
INSERT INTO channels (name, category, sort_order) VALUES
  ('Sitio web o motor de reservas',     'DIRECT',    10),
  ('Booking.com',                        'OTA',       20),
  ('Expedia',                            'OTA',       21),
  ('Airbnb (API)',                       'OTA',       22),
  ('TripAdvisor - Eliminar',             'OTA',       23),
  ('OTA',                                'OTA',       24),
  ('OTA Predeterminada',                 'OTA',       25),
  ('Agencia de viajes',                  'WHOLESALER',30),
  ('Agencia de viajes por defecto',      'WHOLESALER',31),
  ('Mayorista',                          'WHOLESALER',32),
  ('Mayorista por defecto',              'WHOLESALER',33),
  ('Cliente corporativo',                'CORPORATE', 40),
  ('Cliente corporativo predeterminado', 'CORPORATE', 41),
  ('Muelle Bora Bora',                   'DIRECT',    11),
  ('Friends & Family',                   'DIRECT',    12),
  ('Sin reserva previa',                 'DIRECT',    13),
  ('Instagram',                          'DIRECT',    14),
  ('BotMaker',                           'DIRECT',    15),
  ('BotMaker/ Instagram',                'DIRECT',    16),
  ('Correo Electrónico',                 'DIRECT',    17),
  ('Teléfono',                           'DIRECT',    18),
  ('Crisp desde abril',                  'DIRECT',    19),
  ('Zenvia',                             'DIRECT',    20),
  ('Zenvia/ Crisp desde abril',          'DIRECT',    21),
  ('Total Alojamiento',                  'OTHER',     999)
ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order);

-- ----------------------------------------------------------------------------
-- 2. pickup_weekly — DB_PU_WEEK (monitoreo semanal de pickup)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pickup_weekly (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mes                 VARCHAR(20)  NOT NULL,    -- "Enero" .. "Diciembre"
  anio                SMALLINT UNSIGNED NOT NULL,
  fecha_reporte       DATE         NOT NULL,    -- Fecha del reporte semanal
  occ_base_pct        DECIMAL(6,2) NOT NULL,    -- 71.51 (% occupancy base)
  rn_base             INT UNSIGNED NOT NULL,    -- 133 (room nights base)
  ingresos            DECIMAL(15,2) NOT NULL,  -- 217813377.35
  adr_base            DECIMAL(12,2) NOT NULL,  -- 1637694.57
  occ_pickup_pp       DECIMAL(6,2) NOT NULL DEFAULT 0,  -- pickup en pp
  rn_pickup           INT NOT NULL DEFAULT 0,            -- puede ser negativo
  adr_pickup          DECIMAL(12,2) NOT NULL DEFAULT 0,
  revenue_pickup      DECIMAL(15,2) NOT NULL DEFAULT 0,
  source_file         VARCHAR(255) NULL,        -- último archivo que la modificó
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                      ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pickup_nat (anio, mes, fecha_reporte),
  KEY idx_pickup_anio_mes (anio, mes),
  KEY idx_pickup_fecha (fecha_reporte)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. stly_sales — STLY (Same Time Last Year, histórico por semana y canal)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stly_sales (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  semana_num      TINYINT UNSIGNED NOT NULL,    -- 1..53
  fecha_semana    DATE         NOT NULL,
  mes             VARCHAR(20)  NOT NULL,        -- "Enero 2024"
  anio_mes        SMALLINT UNSIGNED NOT NULL,
  channel_id      SMALLINT UNSIGNED NULL,       -- NULL si "Total Alojamiento"
  rn              INT UNSIGNED NOT NULL DEFAULT 0,
  adr             DECIMAL(12,2) NOT NULL DEFAULT 0,
  rev             DECIMAL(15,2) NOT NULL DEFAULT 0,
  source_file     VARCHAR(255) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_stly_nat (fecha_semana, anio_mes, mes, channel_id),
  KEY idx_stly_fecha (fecha_semana),
  KEY idx_stly_anio_mes_canal (anio_mes, mes, channel_id),
  CONSTRAINT fk_stly_channel
    FOREIGN KEY (channel_id) REFERENCES channels(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. channel_sales_month — Venta por canal (agregado mensual)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channel_sales_month (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  anio            SMALLINT UNSIGNED NOT NULL,
  mes             VARCHAR(20)  NOT NULL,
  channel_id      SMALLINT UNSIGNED NOT NULL,
  rn_total        INT UNSIGNED NOT NULL DEFAULT 0,
  adr_promedio    DECIMAL(12,2) NULL,           -- puede ser NULL en el Excel
  revenue_total   DECIMAL(15,2) NOT NULL DEFAULT 0,
  source_file     VARCHAR(255) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_csm_nat (anio, mes, channel_id),
  KEY idx_csm_anio_mes (anio, mes),
  CONSTRAINT fk_csm_channel
    FOREIGN KEY (channel_id) REFERENCES channels(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. predictions — Predicciones (proyecciones 2023-2027)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS predictions (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  anio            SMALLINT UNSIGNED NOT NULL,
  mes             VARCHAR(20)  NULL,            -- NULL = total anual
  scenario        ENUM('OPTIMIST','BASE','PESSIMIST') NOT NULL,
  metric_type     ENUM('OCC','ADR','REV','RN') NOT NULL,
  value           DECIMAL(15,4) NOT NULL,
  notes           TEXT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pred_nat (anio, mes, scenario, metric_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. recommendations — Recomendaciones (texto libre)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendations (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  fecha           DATE         NOT NULL,
  categoria       VARCHAR(50)  NOT NULL,        -- "Pricing", "Canal", "Operaciones"
  titulo          VARCHAR(200) NOT NULL,
  descripcion     TEXT         NOT NULL,
  prioridad       ENUM('ALTA','MEDIA','BAJA') NOT NULL DEFAULT 'MEDIA',
  estado          ENUM('PENDIENTE','EN_CURSO','COMPLETADA') NOT NULL DEFAULT 'PENDIENTE',
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rec_fecha (fecha),
  KEY idx_rec_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. ingest_log — auditoría de cargas Excel
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingest_log (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_file     VARCHAR(255) NOT NULL,
  sheet_name      VARCHAR(80)  NOT NULL,
  rows_inserted   INT UNSIGNED NOT NULL DEFAULT 0,
  rows_updated    INT UNSIGNED NOT NULL DEFAULT 0,
  rows_skipped    INT UNSIGNED NOT NULL DEFAULT 0,
  error_message   TEXT NULL,
  uploaded_by     VARCHAR(120) NULL,           -- "user@email" o "system"
  uploaded_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ingest_at (uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. Modelos SQLAlchemy 2.0 (`backend/app/models.py`)

```python
# backend/app/models.py
"""
SQLAlchemy 2.0 (typed) models para Bora Bora RM.

Notas:
- Usa `Mapped[...]` y `mapped_column(...)` (estilo 2.0, no el legacy 1.x).
- DECIMAL se mapea con `Numeric` (NO `Float`).
- Los índices se declaran en `__table_args__` para que Alembic los autogestione.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, Date, DateTime, Enum, ForeignKey, Integer,
    Numeric, SmallInteger, String, Text, UniqueConstraint, Index, func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# -----------------------------------------------------------------------------
# 1. channels — catálogo
# -----------------------------------------------------------------------------
class Channel(Base):
    __tablename__ = "channels"
    __table_args__ = (
        UniqueConstraint("name", name="uk_channels_name"),
    )

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)
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

    def __repr__(self) -> str:
        return f"<Channel {self.id} {self.name!r}>"


# -----------------------------------------------------------------------------
# 2. pickup_weekly — DB_PU_WEEK
# -----------------------------------------------------------------------------
class PickupWeekly(Base):
    __tablename__ = "pickup_weekly"
    __table_args__ = (
        UniqueConstraint("anio", "mes", "fecha_reporte", name="uk_pickup_nat"),
        Index("idx_pickup_anio_mes", "anio", "mes"),
        Index("idx_pickup_fecha", "fecha_reporte"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
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


# -----------------------------------------------------------------------------
# 3. stly_sales — STLY
# -----------------------------------------------------------------------------
class StlySale(Base):
    __tablename__ = "stly_sales"
    __table_args__ = (
        UniqueConstraint(
            "fecha_semana", "anio_mes", "mes", "channel_id", name="uk_stly_nat"
        ),
        Index("idx_stly_fecha", "fecha_semana"),
        Index("idx_stly_anio_mes_canal", "anio_mes", "mes", "channel_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    semana_num: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    fecha_semana: Mapped[date] = mapped_column(Date, nullable=False)
    mes: Mapped[str] = mapped_column(String(20), nullable=False)
    anio_mes: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    channel_id: Mapped[Optional[int]] = mapped_column(
        SmallInteger,
        ForeignKey("channels.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    channel: Mapped[Optional[Channel]] = relationship(lazy="joined")

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


# -----------------------------------------------------------------------------
# 4. channel_sales_month — Venta por canal
# -----------------------------------------------------------------------------
class ChannelSalesMonth(Base):
    __tablename__ = "channel_sales_month"
    __table_args__ = (
        UniqueConstraint("anio", "mes", "channel_id", name="uk_csm_nat"),
        Index("idx_csm_anio_mes", "anio", "mes"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    anio: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    mes: Mapped[str] = mapped_column(String(20), nullable=False)
    channel_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey("channels.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    channel: Mapped[Channel] = relationship(lazy="joined")

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


# -----------------------------------------------------------------------------
# 5. predictions
# -----------------------------------------------------------------------------
class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (
        UniqueConstraint("anio", "mes", "scenario", "metric_type", name="uk_pred_nat"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
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


# -----------------------------------------------------------------------------
# 6. recommendations
# -----------------------------------------------------------------------------
class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        Index("idx_rec_fecha", "fecha"),
        Index("idx_rec_estado", "estado"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
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


# -----------------------------------------------------------------------------
# 7. ingest_log — auditoría
# -----------------------------------------------------------------------------
class IngestLog(Base):
    __tablename__ = "ingest_log"
    __table_args__ = (Index("idx_ingest_at", "uploaded_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
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
```

---

## 4. Diagrama Entidad-Relación (texto, para ERD tools)

```
channels (1) ────────< (N) stly_sales
channels (1) ────────< (N) channel_sales_month
pickup_weekly    (standalone, sin FKs — semanal agregado)
predictions      (standalone)
recommendations  (standalone)
ingest_log       (standalone, append-only)
```

---

## 5. Plan de Migración desde el Excel

| Hoja Excel | Tabla destino | Frecuencia de carga | Notas |
|---|---|---|---|
| `DB_PU_WEEK` | `pickup_weekly` | Semanal (lunes AM) | UNIQUE(anio, mes, fecha_reporte) → UPSERT |
| `STLY` | `stly_sales` | Trimestral | 30K filas, hacer bulk insert con `executemany` |
| `Venta por canal` | `channel_sales_month` | Mensual | "Total Alojamiento" se ignora (es agregado) |
| `Predicciones` | `predictions` | Anual | Manual o al final de cada año |
| `Recomendaciones` | `recommendations` | Ad-hoc | CRUD normal |
| `Dashboard` | — (no se migra) | — | Es hoja calculada, se reconstruye en runtime |
| `_ChartData` | — (no se migra) | — | Cache de gráficos del Excel, se ignora |
| `Portada` | — (no se migra) | — | Branding/metadata, no es dato |

---

## 6. Variables de entorno (`.env` para el backend)

```bash
# .env (NO commitear — añadir a .gitignore)
DATABASE_URL=mysql+pymysql://bora_user:CHANGE_ME@localhost:3306/bora_bora_rm?charset=utf8mb4
# Hostinger produce el connection string en hPanel → Bases de datos MySQL.
# Si usas un túnel SSH/Cloudflare Tunnel, reemplazar host:port aquí.

# Para desarrollo local
DATABASE_URL_LOCAL=sqlite+aiosqlite:///./bora_bora_rm.db
```

---

## 7. Por qué no usar `mysqlclient` ni `pymysql` directamente

| Driver | Sync/Async | Recomendado |
|---|---|---|
| `pymysql` | Sync puro | ❌ Bloquea el event loop de FastAPI |
| `mysqlclient` | Sync (libmysqlclient) | ❌ Requiere compilar en Hostinger (no apt) |
| **`aiomysql` + `asyncmy`** | Async nativo | ✅ **Usar este** con `create_async_engine` |
| **`PyMySQL` + SQLAlchemy `pool_pre_ping`** | Sync + pool | ✅ Aceptable para carga baja (<100 req/s) |

Para producción: `mysql+asyncmy://` con `async_sessionmaker`. Para dev local: `sqlite+aiosqlite`.

Ver `backend/app/database.py` en la siguiente sección.
