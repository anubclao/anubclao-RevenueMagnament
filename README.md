# Bora Bora — Revenue Management Platform

Plataforma para digitalizar y analizar el informe ejecutivo mensual del
**Hotel Bora Bora**. Reemplaza el Excel manual por una base de datos MySQL
y un dashboard Next.js 15 fullstack (API Routes + UI en el mismo server).

## Estructura

```
RevenueManager/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Landing
│   ├── layout.tsx              # Root layout
│   ├── dashboard/              # Dashboard principal
│   │   ├── page.tsx
│   │   └── components/
│   │       ├── DashboardClient.tsx
│   │       ├── FiltersBar.tsx
│   │       ├── MetricsCards.tsx
│   │       ├── OccAdrChart.tsx
│   │       ├── PickupChart.tsx
│   │       ├── ChannelMixChart.tsx
│   │       └── CurvaPickupChart.tsx
│   ├── api/                    # Backend (Next.js API Routes)
│   │   ├── health/route.ts
│   │   ├── upload-excel/route.ts
│   │   ├── dashboard/{metrics,charts,tendencia-mensual}/route.ts
│   │   ├── pickup/route.ts
│   │   ├── stly/route.ts
│   │   ├── channels-sales/route.ts
│   │   ├── channels/route.ts
│   │   ├── predictions/route.ts
│   │   └── ingest-log/route.ts
│   ├── stly/page.tsx
│   ├── channels-sales/page.tsx
│   ├── predictions/page.tsx
│   ├── pickup/page.tsx
│   └── upload/page.tsx
├── lib/                        # Utilidades compartidas
│   ├── api.ts                  # Cliente HTTP + SWR keys
│   ├── db.ts                   # MySQL pool singleton
│   ├── types.ts                # Tipos compartidos
│   ├── format.ts               # COP formatting
│   ├── useFilters.ts           # Filtros <-> URL search params
│   ├── excel.ts                # Parser Excel (exceljs)
│   ├── filters.ts              # KPI service
│   └── predictions.ts          # Predicciones
├── components/                 # (reservado para componentes compartidos)
├── docs/
│   ├── DEPLOY_HOSTINGER.md
│   ├── init.sql                # DDL ejecutable en phpMyAdmin
│   ├── seed_data.sql           # Dump completo con data
│   └── decisions.md
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── .env.example
├── .env.local                  # (gitignored) — credenciales DB local
└── README.md
```

> 📦 El backend FastAPI original (carpeta `backend/`) queda archivado
> pero ya no se usa. Todo el backend ahora son API Routes dentro de `app/api/`.

## Quickstart

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar env vars
copy .env.example .env.local
# Editar .env.local con credenciales MySQL (DB_HOST, DB_USER, DB_PASS, DB_NAME)

# 3. Levantar dev server
npm run dev
```

App: http://localhost:3000/dashboard

## Cargar el Excel

Ve a http://localhost:3000/upload y arrastra el archivo
`BORA_BORA_Informe_Ejecutivo FINAL.xlsx`. El sistema lo procesa y los
datos aparecen en el dashboard.

## Producción (Hostinger)

Un solo server Next.js fullstack en Hostinger Node.js. Ver
`docs/DEPLOY_HOSTINGER.md` para instrucciones paso a paso.

| Capa | Servicio |
|---|---|
| App | Next.js 15 en Hostinger Premium (Node.js) |
| DB | MySQL 8 en Hostinger (mismo plan) |

## Stack

- **Frontend + Backend:** Next.js 15.1, React 19, TypeScript 5.7
- **DB driver:** mysql2 (Node)
- **DB:** MySQL 8 (utf8mb4)
- **Excel parser:** exceljs 4.4
- **Charts:** Recharts 2.15 (barras combinadas, donut, áreas)
- **Data fetching:** SWR 2.3
- **Estilos:** Tailwind 3.4 + clsx + tailwind-merge

## Características

- ✅ Filtros sincronizados con la URL (compartible, sobrevive a F5)
- ✅ Skeleton loaders mientras llegan los datos
- ✅ Tooltips enriquecidos con todos los datos del punto
- ✅ Validación de tipos en backend (Pydantic) y frontend (TypeScript)
- ✅ Sanitización de NaN/None del Excel → 0 o null en JSON
- ✅ UPSERT idempotente (re-subir el Excel no duplica filas)
- ✅ Auditoría de cargas (tabla `ingest_log`)
- ✅ Moneda COP con formato compacto para charts
