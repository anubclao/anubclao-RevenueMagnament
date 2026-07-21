# Bora Bora RM — Backend (FastAPI)

## Quickstart (local con SQLite)

```bash
# 1) Crear virtualenv
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/macOS

# 2) Instalar deps
pip install -r requirements.txt

# 3) Configurar .env (dev usa SQLite por defecto)
copy .env.example .env          # Windows
# cp .env.example .env          # Linux

# 4) Crear tablas y sembrar catálogo de canales
python -m scripts.seed

# 5) Arrancar
uvicorn app.main:app --reload --port 8000
```

Abre:
- API: http://localhost:8000
- Docs interactivos (Swagger): http://localhost:8000/docs
- Health: http://localhost:8000/api/health

## Endpoints principales

| Método | Path | Descripción |
|---|---|---|
| `GET`  | `/api/health` | Health check (incluye DB ping) |
| `POST` | `/api/upload-excel` | Sube y procesa el Excel completo (DB_PU_WEEK, STLY, Venta por canal) |
| `GET`  | `/api/dashboard/metrics?year=2026&months=Enero&months=Febrero` | KPIs agregados |
| `GET`  | `/api/dashboard/charts?year=2026` | 4 series listas para Recharts |
| `POST` | `/api/pickup` | Crear/actualizar un registro de pickup (form manual) |
| `GET`  | `/api/pickup?year=2026&mes=Enero` | Listar pickups |
| `POST` | `/api/stly` | Crear/actualizar un registro STLY |
| `GET`  | `/api/stly?year=2026&channel_id=2` | Listar STLY |

## Producción (MySQL en Hostinger)

1. Crear DB y usuario en hPanel → Bases de datos MySQL.
2. Ejecutar `docs/architecture.md` §2 (`init.sql`) en phpMyAdmin.
3. `DATABASE_URL=mysql+asyncmy://USER:PASS@HOST:3306/bora_bora_rm?charset=utf8mb4`
4. `APP_ENV=production`
5. Arrancar con `uvicorn` o detrás de nginx + gunicorn.

**⚠️ Importante sobre Hostinger:** los planes "Premium" / "Business" de Node.js
**no soportan procesos Python persistentes**. Si tu plan es Node, deploya el
backend Python en otro host (Railway / Render / Fly.io) y usa Hostinger
solo para el frontend Next.js + la MySQL. Ver `docs/decisions.md` §1.
