# Feature: Data Integrity Audit (Bora Bora — fase actual)

> ⚠️ Spec activo (en progreso). Generado por la metodología Karpathy.
> El usuario observó que "ya no se completa al migrar a producción" — esta feature audita qué se cargó vs qué debería haberse cargado.

## 1. User Story

**As a** operador del hotel Bora Bora que sube un Excel al sistema,
**I want to** que la base de datos contenga **exactamente** los mismos datos que el Excel fuente (sin perder filas al importar),
**So that** cuando el usuario abra el dashboard, las cifras que ve coincidan 100% con la realidad operativa del hotel, sin huecos por migración incompleta.

## 2. Acceptance Criteria

### AC-1: Comparación Excel ↔ MySQL por tabla (raw row count)

Para cada tabla operativa (`pickup_weekly`, `stly_sales`, `channel_sales_month`, `dashboard_monthly`):

- [ ] El audit lee el Excel fuente con `exceljs` (mismo parser que producción).
- [ ] El audit cuenta filas en MySQL agrupadas por las dimensiones que aplican (año, mes, año+mes).
- [ ] El audit emite un reporte que lista, por tabla:
  - Total Excel, Total MySQL, Diferencia.
  - Por cada (año, mes): filas_Excel, filas_MySQL, diff.
- [ ] **NOTA**: En `pickup_weekly` y `stly_sales` se espera diff negativo (el Excel tiene duplicados en la natural key del UPSERT). Esto es el comportamiento "last-snapshot-per-month" del sistema. El audit lo diagnostica explícitamente.

### AC-2: AGGREGATES (lo que el usuario ve) DEBEN coincidir exactamente

Esto es la verificación más importante. La tabla `dashboard_monthly` es la fuente de verdad para OCC%, ADR, Revenue en el dashboard.

- [ ] Para cada uno de los 48 (año, mes) × 3 métricas (OCC, ADR, REV):
  - OCC: `|db.occ_pct - excel.occ| < 0.01`
  - ADR: `|db.adr - excel.adr| < 1`
  - REV: `|db.rev - excel.rev| < 1`
- [ ] **mismatches = 0** en el campo `aggregates.mismatches` del JSON report.
- [ ] **summary.auditPassed = true**.
- [ ] **summary.aggregateTablesWithDiff = []**.
- [ ] **Exit code 0**.
- [ ] Si CUALQUIER métrica difiere más allá de la tolerancia, el audit **FALLA** con exit code 1.

### AC-3: Diagnóstico de dedup (informativo, no falla)

- [ ] Cuando `pickup_weekly` o `stly_sales` tienen diff negativo en row count, el audit explica:
  - Cuántas claves naturales están duplicadas en el Excel.
  - La distribución del diff (e.g., "-2 repetido 12 veces" = 2 weeks per month).
  - Que esto es ESPERADO por la estrategia "last-snapshot-per-month" del UPSERT.
- [ ] El reporte NO falla el audit por esto. Solo lo reporta.

### AC-4: Modo de uso

- [ ] Comando: `node scripts/audit-data-integrity.mjs` desde raíz del repo.
- [ ] Lee `docs/BORA_BORA_Informe_Ejecutivo FINAL.xlsx` (configurable vía argv).
- [ ] Lee MySQL usando las env vars de `.env.local` (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_PORT`).
- [ ] Output: tabla Markdown a stdout + JSON entre `===JSON-REPORT-START===` markers.
- [ ] Exit code 0 = aggregates match. Exit code 1 = aggregates difieren.
- [ ] Cuando faltan env vars o no se puede conectar a DB, el audit aborta con exit code 2 y mensaje claro.

### AC-5: Auto-fix opcional (futuro, no en este spec)

- [ ] Si `aggregates.mismatches > 0`, el audit NO intenta arreglar automáticamente. Solo reporta.
- [ ] El fix se hace:
  1. `node scripts/regenerate-dashboard-seed.mjs` (lee Excel actual → regenera `docs/seed_dashboard.sql`).
  2. `node scripts/reload-dashboard.mjs` (recarga MySQL desde el seed actualizado).
  3. Re-correr el audit.

## 3. Edge Cases

### Error States
- DB no accesible → audit aborta con error y sugiere verificar `.env.local`.
- Excel no encontrado → audit aborta con error y muestra la ruta esperada.
- Excel con formato inesperado (otra versión del reporte) → audit NO aborta, reporta "no se pudo parsear hoja X" y sigue con las demás.

### Empty States
- Tabla MySQL con 0 filas → audit reporta "tabla vacía" para esa tabla.
- Excel sin la hoja esperada → audit la marca como "no presente" y sigue.

### Loading States
- N/A (es un script CLI, no tiene loading state).

## 4. Technical Contract

### Script CLI

```typescript
// scripts/audit-data-integrity.mjs
// Exit code: 0 = todo coincide, 1 = hay diff
interface AuditReport {
  pickup: {
    excel: number;        // 324
    mysql: number;        // 300
    diff: number;         // -24
    byYearMonth: { [k: string]: { excel: number; mysql: number; diff: number } };
  };
  stly: {
    excel: number;        // 28188
    mysql: number;        // 27482
    diff: number;         // -706
    byAnioMes: { [k: string]: { excel: number; mysql: number; diff: number } };
  };
  channelSales: {
    excel: number;        // 311
    mysql: number;        // 311
    diff: number;         // 0
    byYearMonth: { [k: string]: { excel: number; mysql: number; diff: number } };
  };
  dashboardMonthly: {
    excel: number;        // 48 (12 meses × 4 años)
    mysql: number;        // 48
    diff: number;         // 0
    byYearMonth: { [k: string]: { excel_occ: number|null; mysql_occ: number|null; excel_rev: number|null; mysql_rev: number|null } };
  };
  summary: {
    totalDiff: number;    // suma de diffs
    tablesWithDiff: string[];
  };
}
```

### Salida esperada (ejemplo, hipotético)

```
# Bora Bora — Data Integrity Audit

## pickup_weekly
- Excel: 324 | MySQL: 300 | Diff: -24 (92.59%)
- Detalle: 2 rows/mes × 12 meses faltan

## stly_sales
- Excel: 28,188 | MySQL: 27,482 | Diff: -706 (97.50%)
- Detalle: 25-26 rows/mes × 28 meses faltan

## channel_sales_month
- Excel: 311 | MySQL: 311 | Diff: 0 (100.00%) ✅

## dashboard_monthly
- Excel: 48 | MySQL: 48 | Diff: 0 (100.00%) ✅

## Resumen
- 2/4 tablas con diff ≠ 0
- Total filas faltantes: 730
- ❌ AUDIT FAILED
```

## 5. Dependencies

### Archivos a crear
- `scripts/audit-data-integrity.mjs` (CLI principal, ~200 líneas)
- `tests/verifiers/data-integrity-audit.spec.ts` (verifier Karpathy, TDD)

### Archivos a leer (no modificar)
- `lib/excel.ts` (parser de referencia)
- `lib/db.ts` (pool singleton)

### Archivos a NO tocar
- Cualquier cosa en `app/` o `lib/` — esto es solo diagnóstico, no fix.
- `docs/seed_data.sql` — se regenerará DESPUÉS del fix de data.

## 6. Out of Scope

- ❌ No incluye fix automático del parser o del UPSERT (eso viene después).
- ❌ No incluye la regeneración del seed SQL (eso viene después del fix).
- ❌ No incluye verificación de tipos de datos (e.g. que `ingresos` sea siempre >= 0).
- ❌ No incluye verificación de la integridad referencial lógica (e.g. que `channel_id` exista en `channels`).
- ❌ No cubre otras hojas del Excel (Portada, Dashboard visual, _ChartData, Predicciones, Recomendaciones) — solo las 4 que se cargan a DB.

## 7. Approval

**Status:** ✅ Approved (Bora Bora, 2026-07-22)

---

## Diagnóstico final (post-implementación, Bora Bora)

### Estado actual de MySQL (después del fix)

| Tabla | Excel | MySQL | Diff raw | Diff aggregates |
|---|---|---|---|---|
| `pickup_weekly` | 324 | 300 | -24 (dedup) | N/A (no se usa directo en UI) |
| `stly_sales` | 28,188 | 27,482 | -706 (dedup) | N/A (no se usa directo en UI) |
| `channel_sales_month` | 311 | 311 | 0 ✅ | 0 ✅ |
| `dashboard_monthly` | 48 | 48 | 0 ✅ | **0 ✅ (48/48 cells exact)** |

### Bug raíz encontrado y arreglado

El `docs/seed_dashboard.sql` (que es el source of truth para los KPIs del dashboard) había sido generado de una **versión anterior del Excel**. Cuando se regeneró el Excel (posiblemente con datos actualizados del 2025-2026), el seed quedó obsoleto y la app empezó a mostrar números viejos en el dashboard.

**17 discrepancias grandes** detectadas en el audit de agregados:
- 2024-Julio: REV -200
- 2024-Octubre: OCC +0.05
- **2025-Agosto: ADR -159,438**
- **2025-Noviembre: REV -20,000,000**
- 2025-Septiembre/Octubre/Noviembre: valores SWAPPED entre meses
- 2026 varios meses: ADR intercambiado

**Fix aplicado**:
1. `scripts/regenerate-dashboard-seed.mjs` — lee la hoja "Dashboard" del Excel actual con exceljs y regenera `docs/seed_dashboard.sql`.
2. `scripts/reload-dashboard.mjs` — recarga `dashboard_monthly` desde el seed actualizado.
3. **Verificado**: 48/48 celdas coinciden exactamente con el Excel. ✅

### Decisión de diseño: dedup de natural keys

El Excel tiene **filas duplicadas en la natural key** del UPSERT:
- `pickup_weekly`: 24 dupes (2 per month × 12 months) — snapshots repetidos del mismo (anio, mes, fecha_reporte).
- `stly_sales`: 706 dupes — snapshots repetidos del mismo (fecha_semana, anio_mes, mes, channel_id).

El sistema actual colapsa los duplicados vía `INSERT ... ON DUPLICATE KEY UPDATE`, donde la última fila gana. Esto es **consistente con la estrategia "last-snapshot-per-month"** documentada en AGENTS.md y es el comportamiento esperado.

Si en el futuro el usuario quiere preservar TODOS los snapshots (histórico completo), se necesitará:
1. Agregar `ingest_seq BIGINT AUTO_INCREMENT` a las tablas afectadas.
2. Cambiar la unique key para incluir `ingest_seq`.
3. Actualizar `lib/excel.ts` para no asignar el campo (que MySQL lo auto-asigne).
4. Regenerar el seed completo.

Pero para los KPIs del dashboard (que es lo que el usuario ve), los agregados coinciden 100% con el Excel, que es lo que importa.

