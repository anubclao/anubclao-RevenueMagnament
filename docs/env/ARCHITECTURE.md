# Environment & Architecture — Bora Bora Revenue Manager

> Documento de entorno que el agente AI debe leer ANTES de tocar código (PHASE 1 de la metodología Karpathy).

## Project

App web para mostrar análisis de revenue (Occupancy, ADR, Revenue, Pickup, STLY, Channel Mix) por hotel.
**El usuario ve cifras reales basadas en lo que se sube al sistema — no se permiten desvaríos ni números inventados.**

## Tech Stack (real, no genérico)

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend + Backend | **Next.js 15** (App Router + API Routes) | 15.x |
| Lenguaje | TypeScript strict | 5.x |
| DB driver | `mysql2/promise` (NO SQLAlchemy, NO asyncmy) | 3.11+ |
| Excel parser | `exceljs` | 4.4+ |
| Charts | Recharts (NO Chart.js) | 2.x |
| Data fetching | SWR (NO react-query) | 2.x |
| Estilos | TailwindCSS | 3.x |
| ORM | Ninguno — SQL crudo con `pool.query()` directo | — |
| Deploy | Hostinger Premium (Node.js only, NO Python) | — |
| DB producción | MySQL 8 en Hostinger (compartido, no Docker) | 8.x |

## Hosting Constraints

- **Sin Docker, sin Redis, sin Python.** Hostinger Node.js = solo Node.
- **DB pre-creada por Hostinger** (no se puede hacer `CREATE DATABASE` en el seed).
- **phpMyAdmin parte el dump en batches** con sesiones separadas → ver constraint sobre mysqldump.
- **Re-deploy** (botón morado "Guardar y reimplementar") para que Node relea env vars; Restart no recarga.
- **Build cache corrupto** puede requerir borrar y recrear la app en hPanel (ver decisión en decisions.md).

## Directory Structure (post-flatten)

```
RevenueManager/
├── app/                        # Next.js App Router
│   ├── page.tsx, layout.tsx
│   ├── dashboard/              # /dashboard + components/
│   ├── api/                    # 12 API routes
│   ├── stly/, channels-sales/, predictions/, pickup/, upload/
├── lib/                        # 8 utilidades server-side
│   ├── api.ts                  # fetch wrapper SWR (relative URLs)
│   ├── db.ts                   # mysql2 pool singleton
│   ├── filters.ts              # KPI service (3-layer source)
│   ├── format.ts               # formatCOP, formatOCC, formatPercent
│   ├── useFilters.ts           # URL search params hook
│   ├── excel.ts                # exceljs parser
│   ├── predictions.ts          # Predicciones derivadas
│   └── types.ts
├── components/                 # (reservado)
├── docs/
│   ├── env/                    # ← arquitectura + constraints (este doc)
│   ├── specs/                  # ← specs de features (Karpathy)
│   ├── init.sql                # DDL
│   ├── seed_data.sql           # mysqldump post-procesado
│   ├── DEPLOY_HOSTINGER.md
│   ├── decisions.md
│   └── *.xlsx                  # fuentes de datos (NO se commitean al repo)
├── scripts/                    # ← scripts de auditoría / carga
├── tests/verifiers/            # ← tests TDD (Karpathy)
├── AGENTS.md                   # reglas del proyecto (lee primero)
└── package.json
```

## Data Flow (sube-archivo → dashboard)

```
[Excel.xlsx] 
   → POST /api/upload-excel
   → lib/excel.ts (parsea 3 hojas)
   → pool.query() UPSERT a MySQL
   → SELECT /api/dashboard/{metrics,charts}?year=2026
   → lib/filters.ts (3-layer source)
   → JSON a SWR
   → React + Recharts → usuario
```

## Multi-tenant (futuro)

- Hoy la app es de **un solo hotel** (Bora Bora). Tablas sin `hotel_id`.
- **Plan**: se van a agregar 3 hoteles más como módulos.
- **Auth**: per-hotel con superadmin (no implementado aún).
- **Implicación para schema**: cuando llegue ese momento, agregar `hotel_id` a TODAS las tablas operativas y filtrar en cada query. No usar DBs separadas — es el mismo MySQL compartido de Hostinger.

## Estructura de DB actual (1 hotel)

| Tabla | Origen Excel | Filas actuales | Carga |
|---|---|---|---|
| `channels` | (catálogo) | 25 | Seed inicial |
| `pickup_weekly` | DB_PU_WEEK | 300 | Semanal (UPSERT) |
| `stly_sales` | STLY | 27,482 | Trimestral |
| `channel_sales_month` | Venta por canal | 311 | Mensual (UPSERT) |
| `dashboard_monthly` | Dashboard (TENDENCIA MENSUAL) | 48 | Anual (source of truth KPIs) |
| `predictions` | (derivado) | 0 | Anual |
| `recommendations` | (manual) | 0 | Ad-hoc |
| `ingest_log` | (auditoría) | 17 | Append-only |

## Convenciones

- **snake_case en DB**, **camelCase en TS**.
- **Endpoints REST en kebab-case** (`/api/dashboard/metrics`).
- **Filtros siempre como query params**, nunca en body.
- **Fechas siempre ISO 8601** (`YYYY-MM-DD`).
- **Errores como `{ "ok": false, "error": "..." }`**.
- **URLs relativas** en el frontend (`/api/...`).

## Patrones clave

1. **Server Components por defecto** — solo `'use client'` cuando hay interactividad.
2. **API Routes en `app/api/.../route.ts`** — cada endpoint usa `pool.query()` directo, NO un helper genérico que retorna T[].
3. **Service Layer en `lib/`** — la lógica de negocio (filtros, KPIs, parsing) está en `lib/`, no en route handlers.
4. **Type Safety estricto** — TS strict, sin `any`. Interfaces en `lib/types.ts`.
5. **Recharts con `isAnimationActive={false}`** — bug conocido hace líneas invisibles.
