"""
scripts/reupload_excel.py — Re-carga el Excel Bora Bora en la DB local.

Uso:
    python -m scripts.reupload_excel "ruta/al/archivo.xlsx"

Por qué existe: el endpoint /api/upload-excel a veces se cancela a mitad
(el usuario cierra el tab, o el server se reinicia), dejando datos parciales.
Este script corre local sin HTTP y es más rápido de monitorear.
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

from app.database import session_scope
from app.services.excel_processor import process_excel


async def main(excel_path: str) -> int:
    p = Path(excel_path)
    if not p.exists():
        print(f"ERROR: archivo no existe: {p}")
        return 2

    print(f"Procesando: {p}  ({p.stat().st_size / 1024 / 1024:.1f} MB)")
    start = time.time()
    async with session_scope() as session:
        result = await process_excel(p, session, uploaded_by="reupload_script")
    elapsed = time.time() - start

    print()
    print("=== RESULTADO ===")
    print(f"  Source file:       {result.source_file}")
    print(f"  Sheets:            {', '.join(result.sheets_processed)}")
    print(f"  Rows inserted:     {result.total_rows_inserted}")
    print(f"  Rows updated:      {result.total_rows_updated}")
    print(f"  Rows skipped:      {result.total_rows_skipped}")
    print(f"  Duration:          {elapsed:.1f}s")
    print(f"  Errors:            {len(result.errors)}")
    if result.errors:
        for e in result.errors:
            print(f"    - {e}")
    return 0 if not result.errors else 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    sys.exit(asyncio.run(main(sys.argv[1])))
