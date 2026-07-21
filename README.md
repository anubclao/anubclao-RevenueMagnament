# Bora Bora — Revenue Management Platform

Plataforma para digitalizar y analizar el informe ejecutivo mensual del
**Hotel Bora Bora**. Reemplaza el Excel manual por una base de datos MySQL,
un backend FastAPI/Pandas y un dashboard Next.js con Recharts.

## Estructura

```
RevenueManager/
├── backend/                    # FastAPI + SQLAlchemy + Pandas
│   ├── app/
│   │   ├── main.py             # FastAPI app
│   │   ├── config.py           # Settings (Pydantic v2)
│   │   ├── database.py         # Async engine + session
│   │   ├── models.py           # SQLAlchemy 2.0 typed models
│   │   ├── schemas.py          # Pydantic request/response
│   │   ├── routers/
│   │   │   ├── upload.py       # POST /api/upload-excel
│   │   │   ├── dashboard.py    # GET /api/dashboard/{metrics,charts}
│   │   │   ├── pickup.py       # POST/GET /api/pickup
│   │   │   └── stly.py         # POST/GET /api/stly
│   │   └── services/
│   │       ├── excel_processor.py  # Lee xlsx, UPSERT a MySQL
│   │       └── kpi_service.py      # Cálculo de KPIs y series
│   ├── scripts/seed.py         # Crea tablas + siembra canales
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                   # Next.js 15 + Tailwind + Recharts
│   ├── app/
│   │   ├── page.tsx                    # Landing
│   │   ├── dashboard/
│   │   │   ├── page.tsx                # Server component
│   │   │   └── components/
│   │   │       ├── DashboardClient.tsx  # Orquestador (SWR)
│   │   │       ├── FiltersBar.tsx       # Segmentadores
│   │   │       ├── MetricsCards.tsx     # 4 KPI cards
│   │   │       ├── OccAdrChart.tsx      # (1) OCC + ADR
│   │   │       ├── PickupChart.tsx      # (2) Análisis pickup
│   │   │       ├── ChannelMixChart.tsx  # (3) Mix canales
│   │   │       └── CurvaPickupChart.tsx # (4) Curva vs STLY
│   │   └── upload/page.tsx             # Drag & drop Excel
│   ├── lib/
│   │   ├── api.ts            # Cliente HTTP + SWR keys
│   │   ├── types.ts          # Tipos compartidos con backend
│   │   ├── format.ts         # COP formatting
│   │   └── useFilters.ts     # Filtros <-> URL search params
│   ├── package.json
│   └── .env.example
│
├── docs/
│   ├── architecture.md       # Esquema MySQL + modelos SQLAlchemy
│   ├── decisions.md          # 10 decisiones arquitectónicas
│   └── init.sql              # DDL ejecutable en phpMyAdmin
│
└── README.md                  # Este archivo
```

## Quickstart

### 1. Levantar el backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m scripts.seed        # crea tablas + siembra canales (SQLite)
uvicorn app.main:app --reload --port 8000
```

Swagger: http://localhost:8000/docs

### 2. Levantar el frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

App: http://localhost:3000/dashboard

### 3. Cargar el Excel

Ve a http://localhost:3000/upload y arrastra el archivo
`BORA_BORA_Informe_Ejecutivo FINAL.xlsx`. El sistema lo procesa y los datos
aparecen en el dashboard.

## Producción

⚠️ **Limitación crítica de Hostinger:** los planes Node.js de Hostinger
**no soportan procesos Python persistentes**. Tienes dos opciones:

| Opción | Frontend | Backend | DB | Costo |
|---|---|---|---|---|
| **A. Todo en un host** (recomendado) | Next.js en Hostinger Node.js | Next.js API Routes (mismo server) | Hostinger MySQL | 1 hosting |
| **B. Split** | Next.js en Hostinger Node.js | FastAPI en Railway/Render/Fly.io | Hostinger MySQL (remoto) | 2 hostings |
| **C. Todo Python** | FastAPI + plantillas Jinja | FastAPI | Railway Postgres | 1 hosting |

Si eliges **A**, el código de `backend/` se reemplaza por API Routes dentro
de `frontend/app/api/`. El esquema de DB y todo el frontend **no cambian**.
Ver `docs/decisions.md` §2.

## Stack

- **Backend:** Python 3.11+, FastAPI 0.115, SQLAlchemy 2.0 (async), asyncmy, Pandas 2.2, Pydantic v2
- **Frontend:** Next.js 15, React 19, TypeScript 5.7, Tailwind 3.4, Recharts 2.15, SWR 2.3
- **DB:** MySQL 8 (Hostinger) / SQLite (dev local)
- **Charts:** Recharts (barras combinadas, donut, áreas)

## Características

- ✅ Filtros sincronizados con la URL (compartible, sobrevive a F5)
- ✅ Skeleton loaders mientras llegan los datos
- ✅ Tooltips enriquecidos con todos los datos del punto
- ✅ Validación de tipos en backend (Pydantic) y frontend (TypeScript)
- ✅ Sanitización de NaN/None del Excel → 0 o null en JSON
- ✅ UPSERT idempotente (re-subir el Excel no duplica filas)
- ✅ Auditoría de cargas (tabla `ingest_log`)
- ✅ Moneda COP con formato compacto para charts
