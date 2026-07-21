-- ===========================================================================
-- BORA BORA — Inicialización de esquema MySQL
-- Ejecutar en: Hostinger hPanel → Bases de datos MySQL → phpMyAdmin → SQL
-- Charset obligatorio: utf8mb4 (NO latin1, los tildes se rompen)
--
-- NOTA: Este schema NO incluye FOREIGN KEYS a propósito.
--   Razón: mysqldump genera el dump en orden arbitrario y phpMyAdmin
--   en Hostinger reactiva FOREIGN_KEY_CHECKS entre sentencias, lo que
--   produce error 150 (FK incorrectly formed) al importar el seed.
--   Como esto es un data warehouse de solo lectura y los JOINs van
--   explícitos en SQL, los FKs no aportan valor y rompen el deploy.
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
  name            VARCHAR(80)  NOT NULL,
  display_name    VARCHAR(120) NOT NULL,
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
-- Canales se insertan via seed_data.sql (docs/seed_data.sql)

-- ----------------------------------------------------------------------------
-- 2. pickup_weekly — DB_PU_WEEK
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pickup_weekly (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mes                 VARCHAR(20)  NOT NULL,
  anio                SMALLINT UNSIGNED NOT NULL,
  fecha_reporte       DATE         NOT NULL,
  occ_base_pct        DECIMAL(6,2) NOT NULL,
  rn_base             INT UNSIGNED NOT NULL,
  ingresos            DECIMAL(15,2) NOT NULL,
  adr_base            DECIMAL(12,2) NOT NULL,
  occ_pickup_pp       DECIMAL(6,2) NOT NULL DEFAULT 0,
  rn_pickup           INT NOT NULL DEFAULT 0,
  adr_pickup          DECIMAL(12,2) NOT NULL DEFAULT 0,
  revenue_pickup      DECIMAL(15,2) NOT NULL DEFAULT 0,
  source_file         VARCHAR(255) NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                      ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pickup_nat (anio, mes, fecha_reporte),
  KEY idx_pickup_anio_mes (anio, mes),
  KEY idx_pickup_fecha (fecha_reporte)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. stly_sales — STLY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stly_sales (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  semana_num      TINYINT UNSIGNED NOT NULL,
  fecha_semana    DATE         NOT NULL,
  mes             VARCHAR(20)  NOT NULL,
  anio_mes        SMALLINT UNSIGNED NOT NULL,
  channel_id      SMALLINT UNSIGNED NULL,
  rn              INT UNSIGNED NOT NULL DEFAULT 0,
  adr             DECIMAL(12,2) NOT NULL DEFAULT 0,
  rev             DECIMAL(15,2) NOT NULL DEFAULT 0,
  source_file     VARCHAR(255) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_stly_nat (fecha_semana, anio_mes, mes, channel_id),
  KEY idx_stly_fecha (fecha_semana),
  KEY idx_stly_anio_mes_canal (anio_mes, mes, channel_id)
  -- FK removido a propósito (ver nota al inicio del archivo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. channel_sales_month — Venta por canal
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channel_sales_month (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  anio            SMALLINT UNSIGNED NOT NULL,
  mes             VARCHAR(20)  NOT NULL,
  channel_id      SMALLINT UNSIGNED NOT NULL,
  rn_total        INT UNSIGNED NOT NULL DEFAULT 0,
  adr_promedio    DECIMAL(12,2) NULL,
  revenue_total   DECIMAL(15,2) NOT NULL DEFAULT 0,
  source_file     VARCHAR(255) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_csm_nat (anio, mes, channel_id),
  KEY idx_csm_anio_mes (anio, mes)
  -- FK removido a propósito (ver nota al inicio del archivo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. predictions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS predictions (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  anio            SMALLINT UNSIGNED NOT NULL,
  mes             VARCHAR(20)  NULL,
  scenario        ENUM('OPTIMIST','BASE','PESSIMIST') NOT NULL,
  metric_type     ENUM('OCC','ADR','REV','RN') NOT NULL,
  value           DECIMAL(15,4) NOT NULL,
  notes           TEXT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pred_nat (anio, mes, scenario, metric_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. recommendations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendations (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  fecha           DATE         NOT NULL,
  categoria       VARCHAR(50)  NOT NULL,
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
-- 7. ingest_log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingest_log (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_file     VARCHAR(255) NOT NULL,
  sheet_name      VARCHAR(80)  NOT NULL,
  rows_inserted   INT UNSIGNED NOT NULL DEFAULT 0,
  rows_updated    INT UNSIGNED NOT NULL DEFAULT 0,
  rows_skipped    INT UNSIGNED NOT NULL DEFAULT 0,
  error_message   TEXT NULL,
  uploaded_by     VARCHAR(120) NULL,
  uploaded_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ingest_at (uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. dashboard_monthly — TENDENCIA MENSUAL del Excel (hoja Dashboard)
-- OCC/ADR/REV por mes × año. Sirve como fallback de pickup_weekly para años
-- históricos y como referencia anual para 2026.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dashboard_monthly (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  anio            SMALLINT UNSIGNED NOT NULL,
  mes             VARCHAR(20)  NOT NULL,
  occ_pct         DECIMAL(6,2)  NOT NULL DEFAULT 0,
  adr             DECIMAL(12,2) NOT NULL DEFAULT 0,
  rev             DECIMAL(15,2) NOT NULL DEFAULT 0,
  source_file     VARCHAR(255) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_dm_nat (anio, mes),
  KEY idx_dm_anio (anio),
  KEY idx_dm_mes  (mes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Datos se insertan via docs/seed_dashboard.sql
