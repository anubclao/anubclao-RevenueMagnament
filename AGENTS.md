# AGENTS.md — Bora Bora Revenue Manager

> Contexto para agentes AI (Claude/Cursor/MiniMax Code/etc) que trabajen en este proyecto.

## Lo más importante primero

1. **Moneda es COP, no USD.** Ver `docs/decisions.md` §1. El símbolo `$` en el Excel es peso colombiano.
2. **Hostinger NO soporta Python en planes Node.js.** Ver `docs/decisions.md` §2. El código actual es FastAPI pero el plan A real es migrar a Next.js API Routes.
3. **Catálogo de canales en tabla `channels`.** No insertar canales en `stly_sales` o `channel_sales_month` con string libre. Usar `channels.get_id(name)` en el processor.
4. **Sanitización de NaN/None en el processor.** Ver `_to_decimal`, `_to_int`, `_to_date` en `backend/app/services/excel_processor.py`. NUNCA pasar `np.nan` o `pd.NaT` al JSON response.
5. **Filtros en URL, no en estado global.** El componente `useFilters` ya sincroniza con `useSearchParams`. No agregar Context ni Redux.
6. **SQLite NO auto-incrementa `BIGINT PRIMARY KEY`** — solo `INTEGER PRIMARY KEY`. Usar `Integer` para todos los PKs. (Verificado el 2026-07-20.)
7. **Pydantic v2 con listas en `.env`:** declarar el campo como `str` y convertir en property. Si se declara como `List[str]`, Pydantic intenta parsearlo como JSON y falla.
8. **`App_cors_origins` debe ser string CSV**, no JSON array en el .env.
9. **StlySale.semana_num llega hasta 120** (semana del año + offset multi-año), no 53. El schema Pydantic debe permitir hasta 200. Si el Excel trae datos históricos con semana > 53, el `model_validate` falla con 500.
10. **PowerShell `Invoke-WebRequest` muestra mal los acentos** en consola (decodifica como Latin-1). El JSON del backend está correcto en UTF-8; el navegador los renderiza bien. Si ves "Tel�fono" en tests PowerShell, es ruido de la terminal, no bug.
11. **`ChannelCache.get_id` skipea "Total Alojamiento" devolviendo None** pero la fila IGUAL se inserta en `stly_sales` con `channel_id=NULL`. Eso es correcto (es un subtotal), pero ensucia los joins. Si quieres datos limpios, filtra en el kpi_service con `WHERE channel_id IS NOT NULL`.

## Comandos frecuentes

### Backend
```bash
cd backend
.venv\Scripts\activate
python -m scripts.seed                       # crea DB + siembra canales
uvicorn app.main:app --reload --port 8000    # dev server
```

### Frontend
```bash
cd frontend
npm run dev          # localhost:3000
npm run build        # build de producción
npm run typecheck    # tsc --noEmit
```

## Estructura de datos — resumen

| Tabla | Origen Excel | Filas aprox | Carga |
|---|---|---|---|
| `pickup_weekly` | DB_PU_WEEK | 325 | Semanal (UPSERT) |
| `stly_sales` | STLY | 30,368 | Trimestral (bulk insert) |
| `channel_sales_month` | Venta por canal | 315 | Mensual (UPSERT) |
| `predictions` | Predicciones | 52 | Anual (form manual) |
| `recommendations` | Recomendaciones | 34 | Ad-hoc (CRUD) |
| `channels` | (catálogo) | 25 | Seed inicial |
| `ingest_log` | (auditoría) | N | Append-only |

## Decisiones que ya están tomadas (no abrir debate)

- ✅ Moneda: COP
- ✅ Driver DB: `asyncmy` (no `pymysql` sync)
- ✅ ORM: SQLAlchemy 2.0 typed (no 1.x legacy)
- ✅ Pool DB: `pool_pre_ping=True` (crítico para Hostinger que recicla conexiones)
- ✅ Charts: Recharts (no Chart.js — Recharts se integra mejor con Tailwind)
- ✅ Data fetching: SWR (no react-query — menos KB y mismo API para este caso)
- ✅ Routing: App Router de Next 15
- ✅ TypeScript strict: true
- ✅ Decimal en backend: `Numeric(15,2)` para dinero, `Numeric(6,2)` para %, `Numeric(12,2)` para ADR
- ✅ Float en frontend: `number` — la conversión se hace en el formatter con `Intl.NumberFormat`

## Convenciones

- **Snake_case en DB y Python**, **camelCase en TypeScript**.
- **Endpoints REST en kebab-case** (`/api/dashboard/metrics`).
- **Filtros siempre como query params**, nunca en body.
- **Fechas siempre ISO 8601** (`YYYY-MM-DD`).
- **Errores como `{ "detail": "..." }`** (formato de FastAPI).
- **Una sola responsabilidad por archivo** en `services/`.

## Tests pendientes (TODO)

- [ ] `backend/tests/test_excel_processor.py` — fixture con un .xlsx pequeño
- [ ] `backend/tests/test_kpi_service.py` — fixtures de DB en SQLite
- [ ] `frontend/__tests__/DashboardClient.test.tsx` — mock SWR
- [ ] `frontend/e2e/upload.spec.ts` — Playwright

## Estado actual (verificado 2026-07-20)

✅ **Backend completo** — 12 archivos Python, syntax OK, server corriendo en :8000
✅ **Frontend completo** — 19 archivos TS/TSX, typecheck OK, server corriendo en :3000
✅ **Excel cargado** — 31,001 filas en DB (325 DB_PU_WEEK + 30,368 STLY + 308 Venta por canal)
✅ **End-to-end verificado** — Dashboard en :3000 muestra datos reales del Excel
✅ **KPI cards renderizan** — $24.36B ingresos, $1.279.237 ADR, 33,57% occ, 19.039 RN
✅ **Donut chart funcional** — Booking.com 56.6%, Sitio web 18.7%, etc.
✅ **Screenshot en `screenshots/dashboard_full.png`** — prueba visual de funcionamiento

## Archivos críticos que NO romper

- `backend/app/services/excel_processor.py` — la lógica de UPSERT y sanitización
- `backend/app/services/kpi_service.py` — el cálculo de variación anual (mismo mes año anterior)
- `backend/app/models.py` — los modelos SQLAlchemy (Integer PK por SQLite)
- `backend/app/config.py` — Pydantic settings con CORS como string CSV
- `frontend/lib/useFilters.ts` — el hook de filtros/URL
- `frontend/lib/format.ts` — los formatters de COP
- `docs/init.sql` — el DDL que se ejecuta en Hostinger hPanel
