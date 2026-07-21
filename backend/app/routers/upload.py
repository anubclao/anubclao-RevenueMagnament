"""
routers/upload.py — POST /api/upload-excel

Recibe un .xlsx (multipart), lo guarda temporalmente y lo procesa.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_session
from ..schemas import IngestResult
from ..services.excel_processor import process_excel

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload-excel", response_model=IngestResult)
async def upload_excel(
    file: UploadFile = File(..., description="Archivo .xlsx de Bora Bora"),
    uploaded_by: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> IngestResult:
    # 1) Validar extensión
    ext = Path(file.filename or "").suffix.lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Extensión {ext!r} no permitida. Solo {settings.allowed_extensions}",
        )

    # 2) Leer y validar tamaño
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > settings.max_upload_mb:
        raise HTTPException(
            status_code=413,
            detail=f"Archivo demasiado grande ({size_mb:.1f} MB > {settings.max_upload_mb} MB)",
        )

    # 3) Guardar a temporal
    tmp_dir = Path(tempfile.gettempdir()) / "bora_bora_uploads"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = tmp_dir / f"{os.urandom(8).hex()}_{file.filename}"
    tmp_path.write_bytes(contents)
    logger.info("Upload recibido: {} ({:.2f} MB) -> {}", file.filename, size_mb, tmp_path)

    # 4) Procesar de forma atómica: si falla cualquier sheet, rollback TODO.
    #    Evita dejar datos parciales (ej: 300 pickup en vez de 325) si el server
    #    se cae a mitad del Excel.
    try:
        result = await process_excel(tmp_path, session, uploaded_by=uploaded_by)
        # Forzar commit ANTES de cerrar la sesión — el get_session() también
        # hace commit al final, pero lo hacemos aquí para que el conteo de
        # `total_rows_inserted` en el response sea definitivo.
        await session.commit()
    except Exception as e:
        await session.rollback()
        logger.exception("Error procesando Excel: {}", e)
        raise HTTPException(status_code=500, detail=f"Error procesando Excel: {e!s}")
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass

    return result
