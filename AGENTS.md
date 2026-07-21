# AGENTS.md — Bora Bora Revenue Manager

> Contexto para agentes AI (Claude/Cursor/MiniMax Code/etc) que trabajen en este proyecto.

## Lo más importante primero

1. **Moneda es COP, no USD.** El símbolo `$` en el Excel es peso colombiano.
2. **Stack actual: Next.js 15 fullstack (App Router + API Routes)**. NO hay backend Python/FastAPI. NO hay carpeta `frontend/`. Todo está en la raíz.
3. **Catálogo de canales en tabla `channels`.** No insertar canales en `stly_sales` o `channel_sales_month` con string libre. Usar el `ChannelMap` case-insensitive en la API route.
4. **Charset MySQL `utf8mb4` SIEMPRE.** Al importar seeds, usar `mysql --default-character-set=utf8mb4` y `mysqldump --default-character-set=utf8mb4`. Si no, los tildes se rompen (`Tel├®fono`).
5. **mysqldump + Hostinger phpMyAdmin no se llevan bien.** Quitar TODO el bloque de save/restore (`@OLD_*` / `character_set_client` / `TIME_ZONE`) en el seed antes de importar — phpMyAdmin parte el dump en batches y pierde las variables de sesión.
6. **Sin FOREIGN KEYS en el schema.** Es un data warehouse de solo lectura, los JOINs van explícitos en SQL. Los FKs no aportan y rompen los imports en phpMyAdmin.
7. **Filtros en URL, no en estado global.** El hook `useFilters` ya sincroniza con `useSearchParams`. No agregar Context ni Redux.
8. **Currency formatting sin redondeo:** `formatCOP(v)` retorna el valor completo con `Intl.NumberFormat('es-CO')`. NUNCA aplicar `.toFixed(0)` a dinero.
9. **Decimal en backend:** `Numeric(15,2)` para dinero, `Numeric(6,2)` para %, `Numeric(12,2)` para ADR. En el JSON se serializan como STRING, el frontend convierte con `Number()` cuando lo necesita.
10. **Hostinger Node.js NO recarga env vars con Restart.** Necesita **Redeploy completo** (botón "Guardar y reimplementar" morado) para que el nuevo proceso lea las env vars del panel.

## Comandos frecuentes

### Dev local
```bash
# desde la raíz del repo
npm install
copy .env.example .env.local  # editar con credenciales DB
npm run dev                   # http://localhost:3000
```

### Build de producción
```bash
npm run build
npm start
```

### Typecheck
```bash
npm run typecheck
```

## Estructura del proyecto (post-flatten)

```
RevenueManager/
├── app/                        # Next.js App Router
│   ├── page.tsx, layout.tsx
│   ├── dashboard/              # /dashboard + componentes
│   ├── api/                    # API Routes (/api/dashboard/charts, etc.)
│   ├── stly/, channels-sales/, predictions/, pickup/, upload/
├── lib/                        # Server-side utilities
│   ├── api.ts                  # fetch wrapper para SWR (relative URLs)
│   ├── db.ts                   # mysql2 pool singleton
│   ├── filters.ts              # KPI service (3-layer source logic)
│   ├── format.ts               # formatCOP, formatOCC, formatPercent
│   ├── useFilters.ts           # URL search params hook (client)
│   ├── excel.ts                # exceljs parser
│   ├── predictions.ts          # Predicciones derivadas
│   └── types.ts                # TypeScript types
├── components/                 # (reserved for shared components)
├── docs/
│   ├── init.sql                # DDL (sin FKs)
│   ├── seed_data.sql           # mysqldump post-procesado
│   ├── DEPLOY_HOSTINGER.md     # Pasos de deploy
│   └── decisions.md            # Decisiones históricas del proyecto
├── package.json                # Next.js fullstack en la raíz
├── tsconfig.json               # path alias @/* → ./*
├── .env.example
├── .env.local                  # (gitignored) DB_PASS, etc.
└── backend/                    # FastAPI abandonado, NO se deploya
```

## Estructura de DB — resumen

| Tabla | Origen Excel | Filas | Carga |
|---|---|---|---|
| `pickup_weekly` | DB_PU_WEEK | 300 | Semanal (UPSERT) |
| `stly_sales` | STLY | 27,482 | Trimestral (bulk insert) |
| `channel_sales_month` | Venta por canal | 311 | Mensual (UPSERT) |
| `dashboard_monthly` | TENDENCIA MENSUAL | 48 | Anual (source of truth para KPIs) |
| `predictions` | (derivado) | 0 | Anual (derivado algorítmico) |
| `recommendations` | (manual) | 0 | Ad-hoc (CRUD) |
| `channels` | (catálogo) | 25 | Seed inicial |
| `ingest_log` | (auditoría) | 17 | Append-only |

## Decisiones tomadas (no abrir debate)

- ✅ Moneda: COP
- ✅ Driver DB: `mysql2/promise` (no `asyncmy`, no `asyncpg`)
- ✅ ORM: SQLAlchemy 2.0 typed
- ✅ Pool DB: `pool_pre_ping=True` (crítico para Hostinger que recicla conexiones)
- ✅ Charts: Recharts (no Chart.js)
- ✅ Data fetching: SWR (no react-query)
- ✅ Routing: App Router de Next 15
- ✅ TypeScript strict: true
- ✅ Charts con `isAnimationActive={false}` (bug de Recharts con líneas invisibles)
- ✅ Adaptive charts (pickup charts muestran comparativa interanual cuando no hay pickup del año)
- ✅ `dashboard_monthly` es source of truth para KPIs (no `pickup_weekly` ni `stly_sales`)
- ✅ Single date filter para `fecha_reporte` (no range)
- ✅ Predicciones derivadas algorítmicamente (no del Excel)
- ✅ Sin FOREIGN KEYS
- ✅ ChannelMap case-insensitive + alias para typos del Excel

## Convenciones

- **snake_case en DB**, **camelCase en TypeScript**.
- **Endpoints REST en kebab-case** (`/api/dashboard/metrics`).
- **Filtros siempre como query params**, nunca en body.
- **Fechas siempre ISO 8601** (`YYYY-MM-DD`).
- **Errores como `{ "ok": false, "error": "..." }`** (formato Next.js API Routes).
- **URLs relativas** en el frontend (`/api/...`).
- **Sin `NEXT_PUBLIC_API_BASE_URL`** en prod (Hostinger sirve el mismo dominio).

## Deploy a Hostinger

Resumen de los pasos clave (ver `docs/DEPLOY_HOSTINGER.md` para el detalle):

1. **Subir código a GitHub** (rama `main` del repo `anubclao/anubclao-RevenueMagnament`)
2. **En hPanel → Advanced → Node.js**, configurar la app con Node 22.x, Entry: `npm start`
3. **Variables de entorno** en el panel:
   - `DB_HOST=srv1234.hstgr.io`
   - `DB_PORT=3306`
   - `DB_USER=u652436213_admin`
   - `DB_PASS=Anubclao2026`
   - `DB_NAME=u652436213_revenuemg`
   - `NODE_ENV=production`
4. **Importar el seed** vía phpMyAdmin: `docs/seed_data.sql` (3.6 MB, post-procesado)
5. **Redeploy** después de cambiar env vars (botón "Guardar y reimplementar" morado)
6. **Verificar**: `GET /api/health` debe responder `{"ok":true,"db":true}`

## Archivos críticos que NO romper

- `lib/db.ts` — el pool MySQL con charset utf8mb4 y keep-alive
- `lib/filters.ts` — el KPI service con lógica 3-layer (pickup_weekly + dashboard_monthly + stly_sales)
- `lib/excel.ts` — el parser exceljs (auto-detecta formato del header)
- `lib/useFilters.ts` — el hook de filtros/URL (úsalo, no reinventes)
- `lib/format.ts` — los formatters de COP (nunca redondees)
- `app/api/*/route.ts` — cada endpoint debe usar `pool.query()` directamente, no `query()` helper que retorna T[]
- `app/dashboard/page.tsx` — orquesta los 4 charts y los filtros
- `docs/seed_data.sql` — si regeneras, hazlo con `mysqldump --default-character-set=utf8mb4 --skip-set-charset` y luego quita TODAS las líneas `/*!SET @OLD_*` y `/*!SET character_set_client` con el post-procesado documentado
- `docs/init.sql` — el DDL sin FKs que se ejecuta en Hostinger hPanel

## Estado actual (verificado 2026-07-21)

✅ **Single Next.js app** (frontend + API routes) en raíz
✅ **Build local OK** (`npm run build` pasa, 12 API routes + 6 pages)
✅ **Typecheck local OK** (`tsc --noEmit` pasa)
✅ **DB local con datos:** 25 channels, 300 pickup, 27,482 stly, 311 csm, 48 dashboard_monthly
✅ **Deploy a Hostinger** (`anubclao-RevenueMagnament`, rama main)
✅ **App arranca** en Hostinger (Ready in 90ms)
⚠️ **Pendiente:** env vars no se leen (necesita redeploy completo) + el último deploy falló por build cache corrupto, se limpia con un nuevo commit

## TODO

- [ ] E2E tests con Playwright
- [ ] Tabla `predictions` poblada con datos derivados
- [ ] CRUD UI para `recommendations` (hoy es solo API)
- [ ] Login/auth (ahora la app es pública)
