# Project Constraints & Rules

> Reglas que el agente AI debe respetar (PHASE 1 de Karpathy, leído junto con ARCHITECTURE.md).

## Regla de oro: cifras reales, no inventadas

Esta es una app de **análisis de datos**. El usuario espera ver exactamente lo que se cargó al sistema.
**Está prohibido:**
- Inventar valores
- Mostrar promedios cuando no hay datos
- Usar datos de un año como si fueran de otro
- "Rellenar" celdas vacías con 0 sin que sea realmente 0

Si una métrica no tiene datos para el periodo seleccionado, **la UI debe decir "sin datos"**, no mostrar números arbitrarios.

## TypeScript Rules

- ✅ `strict: true` en tsconfig.
- ❌ **No `any`** — usar `unknown` + type guards.
- ✅ Interfaces para props de componentes en `lib/types.ts`.
- ✅ Type guards para runtime checks.

## Component Rules

- ✅ Funcionales únicamente, no class.
- ✅ Props destructurados en la firma.
- ✅ Mantener componentes < 150 líneas (split si es necesario).

## API Rules

- ✅ Todas las API routes usan `pool.query()` directamente, NO un helper `query()` que retorna `T[]` (esos sirven para SELECT, NO para INSERT/UPDATE que necesitan `OkPacket`).
- ✅ `INSERT ... ON DUPLICATE KEY UPDATE` para UPSERT atómico.
- ✅ Errores siempre `{ "ok": false, "error": "..." }`.
- ✅ Filtros como query params, nunca en body.
- ✅ Fechas ISO 8601 (`YYYY-MM-DD`).

## Data Rules

- ✅ **Moneda COP** — símbolo `$` en Excel es peso colombiano, NO USD.
- ✅ **Currency formatting sin redondeo** — `formatCOP(v)` con `Intl.NumberFormat('es-CO')`. NUNCA `.toFixed(0)` en dinero.
- ✅ **Decimal en backend** — `Numeric(15,2)` para dinero, `Numeric(6,2)` para %, `Numeric(12,2)` para ADR. Se serializan como STRING en JSON.
- ✅ **Charset MySQL `utf8mb4` SIEMPRE** — `mysql --default-character-set=utf8mb4` y `mysqldump --default-character-set=utf8mb4`.
- ✅ **Sin FOREIGN KEYS** — es data warehouse, los JOINs son explícitos. FKs rompen phpMyAdmin imports.
- ✅ **KPIs usan último snapshot por mes** (NO sumar todos los snapshots — infla).
- ✅ **`dashboard_monthly` es source of truth** para KPIs.
- ✅ **Meses en orden cronológico** en charts (Enero → Diciembre).
- ✅ **Recharts `isAnimationActive={false}`** en todo `<Line>`, `<Area>`, `<Bar>`.

## Channel Rules

- ✅ **Catálogo en `channels`**, no string libre en otras tablas.
- ✅ **ChannelMap case-insensitive** (`name.toLowerCase().trim()`) — `BOTMAKER` matches `BotMaker`.
- ✅ **Aliases** para typos del Excel (ej: "Cliente Corporatvio" → id 23).
- ✅ **"Total Alojamiento" = descarte completo** (es subtotal, no dato real de canal).
- ✅ **Última-snapshot-por-mes** en `channel_sales_month` y `pickup_weekly` (evitar inflación).

## Excel Parsing Rules

- ✅ `findHeaderRow` auto-detecta header en filas 1-8.
- ✅ `norm()` preserva ñ/á/é/í/ó/ú/ü (solo quita no-alfanuméricos).
- ✅ Atomic UPSERT `INSERT ... ON DUPLICATE KEY UPDATE`.
- ✅ Channel resolution por nombre en el route, no en el parser.
- ✅ `pool.query()` directo para INSERT/UPDATE (no `query()` helper que retorna T[]).

## Hosting/Deploy Rules

- ✅ **Hostinger Node.js = solo Node**. NO Python, NO FastAPI, NO Docker.
- ✅ **Re-deploy con botón "Guardar y reimplementar"** (morado) — Restart NO recarga env vars.
- ✅ **SQL files DB-agnósticos** — sin `CREATE DATABASE` ni `USE`. Usuario selecciona DB en phpMyAdmin.
- ✅ **mysqldump + Hostinger phpMyAdmin: strip TODO `/*!SET @OLD_*` y `/*!SET character_set_client`** antes de importar.
- ✅ **`--skip-set-charset` no es suficiente** — solo quita `SET NAMES`, no las save/restore variables.
- ✅ **Cuando el build cache se corrompe (3+ fallos con mismo error webpack)**: borrar y recrear la app en hPanel.

## Frontend Rules

- ✅ **Filtros en URL** (`useSearchParams`), NO Context ni Redux.
- ✅ **URLs relativas** en SWR (`/api/...`).
- ✅ **Single date filter** para `fecha_reporte` (no range).
- ✅ **Adaptive charts** — pickup charts muestran comparativa interanual si no hay pickup del año.

## Testing Rules (Karpathy TDD)

- ✅ **Spec PRIMERO** — escribir `docs/specs/<feature>.md` ANTES de código.
- ✅ **Verifiers DESPUÉS** — `tests/verifiers/<feature>.spec.ts` ANTES de código.
- ✅ **Fase Roja primero** — confirmar que los tests fallan antes de implementar.
- ✅ **Fase Verde** — implementar hasta que pasen.
- ✅ **No modificar tests** para hacerlos pasar — arreglar el código.
- ✅ **Sin features fuera del Spec**.

## Out of Scope (no hacer)

- ❌ No agregar `hotel_id` hasta que se implemente multi-tenant (decisión pendiente).
- ❌ No mover a otra DB (Postgres, etc.) — Hostinger Premium es MySQL only.
- ❌ No usar ORM (Prisma, TypeORM) — SQL crudo con `mysql2`.
- ❌ No usar asyncmy/asyncpg — `mysql2/promise` es el driver.
- ❌ No usar react-query — SWR.
- ❌ No usar Chart.js — Recharts.
- ❌ No subir a Vercel/Netlify/Railway — Hostinger.
- ❌ No commit `.env.local` ni PATs de GitHub.

## Git Rules

- ✅ PATs NUNCA en archivos, env vars, ni variables de sesión. Inline solo en `git push` URL.
- ✅ `anubclao/anubclao-RevenueMagnament` es el repo CORRECTO para Hostinger. NO `anubclao/RevenueMagnament` (typo).
- ✅ `.xlsx` NO se commitean (son data files, no código).
- ✅ `backend/` (FastAPI abandonado) está gitignored pero NO se borra del FS.
