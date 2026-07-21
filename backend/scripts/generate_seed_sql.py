"""
Genera docs/seed_data.sql con DDL + INSERTs de los datos actuales.
Uso: python -m scripts.generate_seed_sql
Output: docs/seed_data.sql
"""
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import sqlite3

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "backend" / "bora_bora_rm.db"
OUT_PATH = ROOT / "docs" / "seed_data.sql"

if not DB_PATH.exists():
    print(f"ERROR: DB no encontrada en {DB_PATH}")
    sys.exit(1)


def _sql_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int,)):
        return str(value)
    if isinstance(value, (Decimal, float)):
        return str(value)
    if isinstance(value, (date, datetime)):
        return f"'{value.isoformat()}'"
    s = str(value).replace("\\", "\\\\").replace("'", "''")
    return f"'{s}'"


def _get_columns(cur, table):
    cur.execute(f"PRAGMA table_info(`{table}`)")
    return [r[1] for r in cur.fetchall()]


def _dump_table(cur, table):
    columns = _get_columns(cur, table)
    cols_sql = ", ".join(f"`{c}`" for c in columns)

    cur.execute(f"SELECT {cols_sql} FROM `{table}`")
    rows = cur.fetchall()
    if not rows:
        return [], 0

    out = [f"\n-- {table} ({len(rows)} rows)\n"]
    BATCH = 500  # 30K filas / 500 = 60 statements
    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        values_sql = []
        for row in batch:
            row_str = "(" + ", ".join(_sql_value(v) for v in row) + ")"
            values_sql.append(row_str)
        out.append(
            "INSERT INTO `"
            + table
            + "` ("
            + cols_sql
            + ") VALUES\n  "
            + ",\n  ".join(values_sql)
            + ";\n"
        )
    return out, len(rows)


def main():
    print(f"Leyendo DB: {DB_PATH}")
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    lines = [
        "-- ============================================================",
        "-- Hotel Bora Bora Revenue Manager — SEED DATA",
        "-- ============================================================",
        "-- Generado automaticamente desde SQLite local.",
        "-- Carga en Hostinger MySQL:",
        "--   mysql -h <host> -u <user> -p <db_name> < docs/seed_data.sql",
        "--",
        "-- Tablas: channels, pickup_weekly, stly_sales, channel_sales_month, ingest_log",
        "-- Predicciones NO se cargan: se derivan en runtime.",
        "-- ============================================================",
        "",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
        "",
    ]

    ddl_path = ROOT / "docs" / "init.sql"
    if ddl_path.exists():
        lines.append("-- ===== DDL (init.sql embebido) =====")
        ddl_content = ddl_path.read_text(encoding="utf-8")
        # Strip BOM por si acaso
        if ddl_content.startswith("\ufeff"):
            ddl_content = ddl_content[1:]
        lines.append(ddl_content)
        lines.append("")

    tables = [
        "channels",
        "pickup_weekly",
        "stly_sales",
        "channel_sales_month",
        "ingest_log",
    ]

    total = 0
    for table in tables:
        out, count = _dump_table(cur, table)
        if out:
            lines.extend(out)
            total += count
            print(f"  {table}: {count} filas")

    lines.append("\nSET FOREIGN_KEY_CHECKS = 1;\n")
    lines.append(f"-- Total filas: {total}\n")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    # Strip BOM by si acaso
    if OUT_PATH.exists():
        content = OUT_PATH.read_bytes()
        if content.startswith(b"\xef\xbb\xbf"):
            OUT_PATH.write_bytes(content[3:])

    size_mb = OUT_PATH.stat().st_size / (1024 * 1024)
    print(f"\nOK: {OUT_PATH}")
    print(f"     {size_mb:.2f} MB, {total} filas")

    conn.close()


if __name__ == "__main__":
    main()
