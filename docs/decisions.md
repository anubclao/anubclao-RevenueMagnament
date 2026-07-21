# Decisiones Arquitectónicas — Bora Bora RM

> Documento vivo. Cada decisión tiene contexto, alternativas descartadas y consecuencias.

---

## §1. Moneda: COP (peso colombiano), no USD

**Contexto:** el Excel usa el símbolo `$` y la columna se llama "ADR Base ($)". Pero
los valores son claramente COP: ADR entre $1.2M y $1.6M (= COP 1.200.000 a 1.600.000
por noche), ingresos totales en cientos de millones.

**Decisión:** todos los formateos monetarios en el frontend usan
`Intl.NumberFormat("es-CO", { currency: "COP" })`. El backend almacena en
`Numeric(15,2)` sin unidad; la unidad es responsabilidad de la capa de presentación.

**Por qué no USD:** un resort de Cartagena con esos valores en USD costaría
$1,500/noche — plausible para un hotel de lujo. PERO los ingresos anuales
serían $1.5B USD = $1.500 millones de dólares al año, lo cual está fuera de
escala para un hotel boutique. En COP son ~$1.500M COP/mes = $5.7B COP/año,
que es razonable para un resort mediano de Colombia.

**Acción si el cliente dice "es USD":** cambiar `format.ts` línea del `Intl`
y los formateos compactos. La DB no cambia.

---

## §2. Stack: ¿Por qué Next.js + FastAPI si Hostinger es Node?

**Contexto:** el brief del usuario dice "Hostinger APP WEB con Node" pero al
mismo tiempo pide "Python + FastAPI + Pandas". Esos dos son incompatibles en
el mismo plan de hosting.

**Decisión actual (esta entrega):** respetar lo que pidió el usuario — código
FastAPI/Pandas completo, y dejar claro el conflicto.

**Plan B si el cliente decide usar Hostinger Node.js:**
- Reemplazar el backend Python con **Next.js API Routes** (mismo runtime).
- Reemplazar Pandas con `exceljs` o `xlsx` en Node (parseo directo a JSON).
- Reemplazar SQLAlchemy con **Prisma** (más idiomático en Node).
- Mismo esquema MySQL (la DDL no cambia).
- Reemplazar el processor `excel_processor.py` con `app/api/upload-excel/route.ts`.

**Por qué recomiendo Plan B:** menos infra que mantener, 1 solo deploy, mismo
proveedor (Hostinger). La pérdida de Pandas es marginal — para Excel plano,
`exceljs` es igual de capaz.

**Costo del Plan B:** ~3-4 días de reescritura. La DB y el frontend no cambian.

---

## §3. Estructura de carpetas: ¿por qué `app/` y no `src/app/`?

Next.js 13+ soporta ambos. Decidí `app/` en la raíz (sin `src/`) porque:
- Es el default del create-next-app
- La convención de Hostinger para Node.js apps es la misma
- Reduce la profundidad de los imports relativos

---

## §4. ¿Por qué no Shadcn/ui completo?

El brief menciona Shadcn/ui pero instalarlo en su forma canónica (CLI + cn
helper + todos los primitives) añade ~15 archivos y un build step. Para esta
entrega, los componentes están escritos con Tailwind directo. **Si el cliente
quiere Shadcn completo, son 5 minutos:**

```bash
cd frontend
npx shadcn@latest init
npx shadcn@latest add button card select table dialog tabs
```

Los componentes que escribí siguen la **misma API y estilo** que Shadcn
(`<Card>`, `<Button>` con variant, etc.), así que migrar es reemplazar imports.

---

## §5. State global: ¿Redux, Zustand, Context, o solo SWR?

**Decisión:** SWR + URL search params. Sin Context, sin Redux, sin Zustand.

**Por qué:**
- Los filtros son estado de UI, no de aplicación → viven en la URL (search params).
- Los datos del servidor (KPIs, charts) son estado remoto → SWR con cache + revalidación.
- Lo único que necesita ser "global" es el resultado del fetch, y SWR ya lo
  es por su cache key.

**Beneficio concreto:** si el usuario marca "Enero + Febrero 2026", la URL
queda `/dashboard?year=2026&months=Enero&months=Febrero`. Puede mandar ese
link a un compañero y el dashboard abre exactamente igual.

---

## §6. Formato de fechas: ISO 8601 siempre

- Backend: `date` (Python) → `2026-01-07` (ISO).
- JSON wire: `"2026-01-07"` (string).
- Frontend: `new Date(iso)` → formato `es-CO` con `toLocaleDateString`.

**Por qué no timestamps UNIX:** el Excel no tiene horas, no tiene TZ, y el
hotel opera en una sola zona horaria (America/Bogota). Agregar TZ a la capa
de datos solo trae bugs (DST, cambios de año nuevo, "el lunes son dos lunes").

---

## §7. Filtros: ¿Query params, body, o header?

**Decisión:** todo en query params (`?year=2026&months=Enero`).

**Por qué:**
- Los endpoints quedan cacheables (futuro: añadir `Cache-Control: max-age=60`).
- Funcionan con GET (no se necesita CSRF).
- Fáciles de testear con curl.
- Coinciden 1:1 con los search params del frontend (no hay mapeo).

**Trade-off:** URLs largas si se seleccionan muchos canales. Aceptable para
este caso (max 24 canales).

---

## §8. Performance: ¿por qué bundlear todos los charts en 1 request?

`/api/dashboard/charts` devuelve las 4 series en un solo JSON en vez de 4
endpoints separados. Razón:
- 4 fetches paralelos × latencia de Hostinger = 200-400ms.
- 1 fetch con todo = 50-150ms.
- El payload es ~30KB JSON (pequeño).

Si en el futuro los charts divergen (filtros independientes, paginación), se
rompe en 4 endpoints.

---

## §9. Auditoría: tabla `ingest_log`

Cada upload de Excel deja un registro con:
- filename
- qué hoja se procesó
- cuántas filas se insertaron/actualizaron/omitieron
- quién lo subió
- cuándo

Sin esto, "por qué el KPI de febrero cambió" se vuelve arqueología. Con esto,
un `SELECT * FROM ingest_log ORDER BY uploaded_at DESC LIMIT 10` resuelve el
90% de los tickets de soporte.

---

## §10. Currency formatting: por qué `formatCompactCOP`

El hotel expresa ingresos en **cientos de millones de COP**. `Intl.NumberFormat`
con `style: "currency"` da strings larguísimos:
- `formatCOP(217813377.35)` → `$ 217.813.377,35` (legible en tarjeta)
- `formatCompactCOP(217813377.35)` → `$217.8M` (legible en chart Y-axis)

Por eso uso `formatCompactCOP` para los ejes de los charts y
`formatCOP` para los tooltips y las KPI cards (donde el usuario quiere ver el
número completo).
