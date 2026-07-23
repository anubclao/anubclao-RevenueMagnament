# AGENTS.md — Bora Bora Revenue Manager

> Contexto para agentes AI (Claude/Cursor/MiniMax Code/etc) que trabajen en este proyecto.

## ⚠️ Workflow OBLIGATORIO: Karpathy Spec → Verifier → Implementation

Este proyecto usa la metodología **Karpathy** (Spec + Verifier + Environment). Lee `/docs/env/ARCHITECTURE.md` y `/docs/env/CONSTRAINTS.md` PRIMERO. Cero código antes de tener spec aprobado y verifier en rojo.

**Fases estrictas:**
1. **Environment** — leer `docs/env/ARCHITECTURE.md` + `docs/env/CONSTRAINTS.md`, confirmar entendimiento en 2-3 oraciones.
2. **Spec** — crear `docs/specs/[feature].md` usando el template `docs/specs/TEMPLATE_feature-spec.md`. Pedir aprobación.
3. **Verifier** — escribir `tests/verifiers/[feature].spec.ts`. Correr, confirmar que fallan (RED).
4. **Implementation** — escribir código para hacer pasar los tests (GREEN).
5. **Refactor** — pasar los tests una vez más, limpiar.

Anti-patterns prohibidos: código antes de spec, modificar tests para que pasen, agregar features fuera del spec, `any` en TS.

---

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

## ⚠️ REGLA DE ORO: cifras reales, no inventadas

App de análisis de datos. **Prohibido** inventar valores, promediar cuando no hay datos, mezclar años. Si no hay datos, la UI dice "sin datos" — nunca muestra números arbitrarios.

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

### Auditoría de datos
```bash
node scripts/audit-data-integrity.mjs   # Excel vs MySQL
```

## Estructura del proyecto (post-flatten)

```
RevenueManager/
├── app/                        # Next.js App Router
│   ├── page.tsx, layout.tsx
│   ├── dashboard/              # /dashboard + componentes
│   ├── api/                    # API Routes
│   ├── stly/, channels-sales/, predictions/, pickup/, upload/
├── lib/                        # Server-side utilities
│   ├── api.ts                  # fetch wrapper para SWR (relative URLs)
│   ├── db.ts                   # mysql2 pool singleton
│   ├── filters.ts              # KPI service (3-layer source logic)
│   ├── format.ts               # formatCOP, formatOCC, formatPercent
│   ├── useFilters.ts           # URL search params hook (client)
│   ├── excel.ts                # exceljs parser
│   ├── predictions.ts          # Predicciones derivadas
│   └── types.ts
├── components/                 # (reserved for shared components)
├── docs/
│   ├── env/                    # ← Karpathy: arquitectura + constraints
│   ├── specs/                  # ← Karpathy: specs de features
│   ├── init.sql                # DDL (sin FKs)
│   ├── seed_data.sql           # mysqldump post-procesado
│   ├── DEPLOY_HOSTINGER.md     # Pasos de deploy
│   └── decisions.md            # Decisiones históricas del proyecto
├── scripts/                    # ← Scripts de auditoría / utilidad
├── tests/verifiers/            # ← Karpathy: TDD tests
├── package.json                # Next.js fullstack en la raíz
├── tsconfig.json               # path alias @/* → ./*
├── .env.example
├── .env.local                  # (gitignored) DB_PASS, etc.
└── backend/                    # FastAPI abandonado, gitignored
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
- ✅ Driver DB: `mysql2/promise`
- ✅ ORM: SQL crudo con `pool.query()` directo
- ✅ Pool DB: `pool_pre_ping=True`
- ✅ Charts: Recharts
- ✅ Data fetching: SWR
- ✅ Routing: App Router de Next 15
- ✅ TypeScript strict: true
- ✅ Charts con `isAnimationActive={false}`
- ✅ Adaptive charts (pickup charts muestran comparativa interanual cuando no hay pickup del año)
- ✅ `dashboard_monthly` es source of truth para KPIs
- ✅ Single date filter para `fecha_reporte`
- ✅ Predicciones derivadas algorítmicamente
- ✅ Sin FOREIGN KEYS
- ✅ ChannelMap case-insensitive + alias para typos del Excel
- ✅ **Metodología Karpathy** (Spec → Verifier → Implementation) para TODO trabajo nuevo

## Convenciones

- **snake_case en DB**, **camelCase en TypeScript**.
- **Endpoints REST en kebab-case** (`/api/dashboard/metrics`).
- **Filtros siempre como query params**, nunca en body.
- **Fechas siempre ISO 8601** (`YYYY-MM-DD`).
- **Errores como `{ "ok": false, "error": "..." }`**.
- **URLs relativas** en el frontend (`/api/...`).
- **Sin `NEXT_PUBLIC_API_BASE_URL`** en prod.

## Deploy a Hostinger

Resumen (ver `docs/DEPLOY_HOSTINGER.md` para detalle):

1. **Push a GitHub** → `anubclao/anubclao-RevenueMagnament` (rama main)
2. **hPanel → Advanced → Node.js** → Node 22.x, Entry: `npm start`
3. **Env vars**: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, NODE_ENV
4. **Importar seed** vía phpMyAdmin: `docs/init.sql` + `docs/seed_data.sql` (3.4 MB, DB-agnósticos)
5. **Re-deploy** después de cambiar env vars (botón morado)
6. **Verificar**: `GET /api/health` → `{"db_ok":true,"env_all_set":true}`

## Archivos críticos que NO romper

- `lib/db.ts` — pool MySQL utf8mb4 keep-alive
- `lib/filters.ts` — KPI service 3-layer
- `lib/excel.ts` — parser exceljs auto-detect
- `lib/useFilters.ts` — hook URL search params
- `lib/format.ts` — formatters COP sin redondeo
- `app/api/*/route.ts` — `pool.query()` directo
- `app/dashboard/page.tsx` — orquesta charts y filtros
- `docs/seed_data.sql` — si regeneras, post-procesar `@OLD_*` y `character_set_client`
- `docs/init.sql` — DDL sin FKs

## Estado actual (verificado 2026-07-22)

✅ Single Next.js app, build local OK, typecheck OK
✅ DB local con datos: 25 channels, 300 pickup, 27,482 stly, 311 csm, 48 dashboard_monthly
✅ SQL listo para Hostinger (init.sql + seed_data.sql, DB-agnósticos, 3.4 MB)
✅ Push a GitHub (commit `f11f574`)
⚠️ **Bloqueado en deploy**: build cache corrupto en hPanel — fix nuclear = borrar y recrear app (5 min)
📌 Credenciales Hostinger: srv1234.hstgr.io, u123456_revenue / u123456_revenuemg, Anubclao2026

## TODO

- [x] ~~Auditoría de integridad de datos~~ → `docs/specs/data-integrity-audit.md` (en progreso)
- [ ] E2E tests con Playwright
- [ ] Tabla `predictions` poblada con datos derivados
- [ ] CRUD UI para `recommendations`
- [ ] Login/auth (ahora la app es pública)
- [ ] Multi-tenant: 3 hoteles más como módulos
- [ ] Superadmin + auth per-hotel
