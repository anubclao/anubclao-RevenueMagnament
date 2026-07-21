/**
 * kpi.ts — Port de kpi_service.py a TypeScript + mysql2.
 *
 * Lógica HÍBRIDA: la fuente de datos depende del año.
 *  - 2026 (año actual con pickup): pickup_weekly para datos semanales, dashboard_monthly para totales
 *  - 2023-2025 (años históricos): channel_sales_month (datos correctos) + dashboard_monthly (OCC)
 *  - channel_sales_month es la fuente principal de revenue/RN (es la que tiene datos correctos)
 *  - stly_sales está corrupto (factor 100x por bug del processor anterior) — no se usa
 *  - dashboard_monthly siempre provee OCC mensual histórica
 */
import { query, queryOne } from "./db";

const MESES_ORDEN = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

export interface DashboardFilters {
  year?: number;
  months?: string[];
  start_date?: string;
  end_date?: string;
  channels?: string[];
  scenario?: "OPTIMIST" | "BASE" | "PESSIMIST";
}

function num(x: unknown): number {
  if (x === null || x === undefined) return 0;
  return Number(x);
}

interface KpiResult {
  total_ingresos: string;
  adr_promedio: string;
  ocupacion_media_pct: string;
  rn_totales: number;
  rn_pickup_total: number;
  revenue_pickup_total: string;
  variacion_anual_pct: number | null;
  fuente?: string;
  filtros_aplicados?: DashboardFilters;
}

/**
 * ¿Hay data de pickup para este año?
 * Usado para decidir fuente: pickup_weekly vs stly_sales.
 */
async function hasPickupData(year: number): Promise<boolean> {
  if (!year) return false;
  const row = await queryOne<{ c: number }>(
    "SELECT COUNT(*) AS c FROM pickup_weekly WHERE anio = ?",
    [year]
  );
  return (row?.c ?? 0) > 0;
}

/**
 * OCC media desde dashboard_monthly para un año (12 meses agregados).
 * Devuelve null si no hay datos en dashboard_monthly.
 */
async function getOccFromDashboard(year: number): Promise<number | null> {
  if (!year) return null;
  const row = await queryOne<{ occ: number | null }>(
    "SELECT AVG(occ_pct) AS occ FROM dashboard_monthly WHERE anio = ?",
    [year]
  );
  if (row?.occ === null || row?.occ === undefined) return null;
  return Number(row.occ);
}

// -----------------------------------------------------------------------------
// /api/dashboard/metrics — KPIs principales (HÍBRIDO)
// -----------------------------------------------------------------------------
export async function getKpiSummary(f: DashboardFilters) {
  if (!f.year) {
    return {
      total_ingresos: "0.00",
      adr_promedio: "0.00",
      ocupacion_media_pct: "0.00",
      rn_totales: 0,
      rn_pickup_total: 0,
      revenue_pickup_total: "0.00",
      variacion_anual_pct: null,
      fuente: "ninguna",
      filtros_aplicados: f,
    };
  }

  const hasPickup = await hasPickupData(f.year);

  // FUENTE DE VERDAD: dashboard_monthly (TENDENCIA MENSUAL del Excel).
  // Coincide al 100% con la Portada del Excel. Tiene OCC, ADR, REV por mes.
  // channel_sales_month se usa SOLO para channel_mix (desglose por canal).
  const dashboardResult = await getKpiFromDashboard(f);

  if (!dashboardResult || num(dashboardResult.total_ingresos) === 0) {
    // Fallback: si dashboard no tiene data, usar channel_sales
    return getKpiFromChannelSales(f);
  }

  // Para el año actual con pickup: añadir métricas de pickup
  if (hasPickup) {
    const pickupResult = await getKpiFromPickup(f);
    const result: KpiResult = {
      total_ingresos: dashboardResult.total_ingresos,
      adr_promedio: dashboardResult.adr_promedio,
      // OCC del dashboard (12 meses completos, alineado con Portada del Excel)
      // pickup_weekly solo tiene data parcial del año actual
      ocupacion_media_pct: dashboardResult.ocupacion_media_pct,
      rn_totales: dashboardResult.rn_totales,
      rn_pickup_total: pickupResult.rn_pickup_total,
      revenue_pickup_total: pickupResult.revenue_pickup_total,
      variacion_anual_pct: null,
    };
    result.fuente = "dashboard_monthly + pickup_weekly (pickup trends)";
    const finalResult = result;
    if (f.year > 2020) {
      const prevF = { ...f, year: f.year - 1 };
      const prev = await getKpiFromDashboard(prevF);
      const prevIng = num(prev.total_ingresos);
      const curIng = num(finalResult.total_ingresos);
      if (prevIng > 0) {
        finalResult.variacion_anual_pct =
          Math.round(((curIng - prevIng) / prevIng) * 10000) / 100;
      }
    }
    finalResult.filtros_aplicados = f;
    return finalResult;
  }

  // Sin pickup: dashboard es la fuente de todo
  const result = dashboardResult;
  result.fuente = "dashboard_monthly";

  // Variación anual
  if (f.year > 2020) {
    const prevF = { ...f, year: f.year - 1 };
    const prev = await getKpiFromDashboard(prevF);
    const prevIng = num(prev.total_ingresos);
    const curIng = num(result.total_ingresos);
    if (prevIng > 0) {
      result.variacion_anual_pct =
        Math.round(((curIng - prevIng) / prevIng) * 10000) / 100;
    }
  }

  result.filtros_aplicados = f;
  return result;
}

/**
 * KPIs desde pickup_weekly (caso 2026, año actual con data semanal completa).
 */
async function getKpiFromPickup(f: DashboardFilters): Promise<KpiResult> {
  const clauses: string[] = ["anio = ?"];
  const params: unknown[] = [f.year];
  if (f.months && f.months.length > 0) {
    const ph = f.months.map(() => "?").join(",");
    clauses.push(`mes IN (${ph})`);
    params.push(...f.months);
  }
  if (f.start_date) {
    clauses.push("fecha_reporte >= ?");
    params.push(f.start_date);
  }
  if (f.end_date) {
    clauses.push("fecha_reporte <= ?");
    params.push(f.end_date);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;

  const row = await queryOne<{
    total_ingresos: string | number;
    rn_totales: number;
    occ_media: string | number;
    rn_pickup_total: number;
    revenue_pickup_total: string | number;
  }>(
    `SELECT
       COALESCE(SUM(ingresos), 0) AS total_ingresos,
       COALESCE(SUM(rn_base + rn_pickup), 0) AS rn_totales,
       COALESCE(AVG(occ_base_pct), 0) AS occ_media,
       COALESCE(SUM(rn_pickup), 0) AS rn_pickup_total,
       COALESCE(SUM(revenue_pickup), 0) AS revenue_pickup_total
     FROM pickup_weekly ${where}`,
    params
  );

  const ingresos = num(row?.total_ingresos);
  const rnTotales = Number(row?.rn_totales ?? 0);
  const occMedia = num(row?.occ_media);
  const rnPickupTotal = Number(row?.rn_pickup_total ?? 0);
  const revPickupTotal = num(row?.revenue_pickup_total);
  const adrPromedio = rnTotales > 0 ? ingresos / rnTotales : 0;

  return {
    total_ingresos: ingresos.toFixed(2),
    adr_promedio: adrPromedio.toFixed(2),
    ocupacion_media_pct: occMedia.toFixed(2),
    rn_totales: rnTotales,
    rn_pickup_total: rnPickupTotal,
    revenue_pickup_total: revPickupTotal.toFixed(2),
    variacion_anual_pct: null, // se setea en getKpiSummary
  };
}

/**
 * KPIs desde stly_sales + channel_sales_month (caso años históricos 2023-2025).
 *
 * IMPORTANTE: stly_sales NO tiene OCC. La ocupacion_media_pct se devuelve como
 * null para años históricos. Si en el futuro se carga la hoja Dashboard del
 * Excel, se puede completar.
 *
 * Si el usuario filtra por canales, sumamos solo los revenue de esos canales.
 */
async function getKpiFromStly(f: DashboardFilters): Promise<KpiResult> {
  const clauses: string[] = ["anio_mes = ?"];
  const params: unknown[] = [f.year];

  if (f.months && f.months.length > 0) {
    // stly_sales.mes viene como "Enero 2025" (con año). Usamos LIKE prefix.
    const likeClauses = f.months.map(() => "mes LIKE ?").join(" OR ");
    clauses.push(`(${likeClauses})`);
    params.push(...f.months.map((m) => `${m} %`));
  }
  if (f.channels && f.channels.length > 0) {
    const ph = f.channels.map(() => "?").join(",");
    clauses.push(
      `channel_id IN (SELECT id FROM channels WHERE name IN (${ph}))`
    );
    params.push(...f.channels);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;

  const stlyRow = await queryOne<{
    total_ingresos: string | number;
    rn_totales: number;
  }>(
    `SELECT
       COALESCE(SUM(rev), 0) AS total_ingresos,
       COALESCE(SUM(rn), 0) AS rn_totales
     FROM stly_sales ${where}`,
    params
  );

  const ingresos = num(stlyRow?.total_ingresos);
  const rnTotales = Number(stlyRow?.rn_totales ?? 0);
  const adrPromedio = rnTotales > 0 ? ingresos / rnTotales : 0;

  // OCC desde dashboard_monthly (TENDENCIA MENSUAL del Excel).
  // stly_sales no tiene OCC, así que Dashboard es la única fuente histórica.
  const occDashboard = f.year !== undefined ? await getOccFromDashboard(f.year) : null;
  const occStr =
    occDashboard === null ? "0.00" : occDashboard.toFixed(2);

  return {
    total_ingresos: ingresos.toFixed(2),
    adr_promedio: adrPromedio.toFixed(2),
    ocupacion_media_pct: occStr,
    rn_totales: rnTotales,
    rn_pickup_total: 0, // No aplica para años históricos
    revenue_pickup_total: "0.00",
    variacion_anual_pct: null,
  };
}

/**
 * KPIs desde channel_sales_month (Venta por canal). Esta es la fuente
 * MÁS CONFIABLE para revenue y RN porque:
 *  - No tiene el factor 100x de stly_sales
 *  - No tiene los datos duplicados de pickup_weekly
 *  - Sus totales anuales coinciden con la Portada del Excel
 *
 * Devuelve revenue, RN, ADR. OCC se obtiene de dashboard_monthly.
 */
async function getKpiFromChannelSales(f: DashboardFilters): Promise<KpiResult> {
  if (!f.year) {
    return {
      total_ingresos: "0.00",
      adr_promedio: "0.00",
      ocupacion_media_pct: "0.00",
      rn_totales: 0,
      rn_pickup_total: 0,
      revenue_pickup_total: "0.00",
      variacion_anual_pct: null,
    };
  }

  const clauses: string[] = ["csm.anio = ?"];
  const params: unknown[] = [f.year];

  if (f.months && f.months.length > 0) {
    // channel_sales_month.mes viene como "Enero" (sin año) — IN exacto funciona
    const ph = f.months.map(() => "?").join(",");
    clauses.push(`csm.mes IN (${ph})`);
    params.push(...f.months);
  }
  if (f.channels && f.channels.length > 0) {
    const ph = f.channels.map(() => "?").join(",");
    clauses.push(`c.name IN (${ph})`);
    params.push(...f.channels);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;

  const row = await queryOne<{
    total_ingresos: string | number;
    rn_totales: number;
  }>(
    `SELECT
       COALESCE(SUM(csm.revenue_total), 0) AS total_ingresos,
       COALESCE(SUM(csm.rn_total), 0) AS rn_totales
     FROM channel_sales_month csm
     JOIN channels c ON c.id = csm.channel_id
     ${where}`,
    params
  );

  const ingresos = num(row?.total_ingresos);
  const rnTotales = Number(row?.rn_totales ?? 0);
  const adrPromedio = rnTotales > 0 ? ingresos / rnTotales : 0;

  return {
    total_ingresos: ingresos.toFixed(2),
    adr_promedio: adrPromedio.toFixed(2),
    ocupacion_media_pct: "0.00", // OCC se setea aparte desde dashboard
    rn_totales: rnTotales,
    rn_pickup_total: 0,
    revenue_pickup_total: "0.00",
    variacion_anual_pct: null,
  };
}
async function getKpiFromDashboard(f: DashboardFilters): Promise<KpiResult> {
  if (!f.year) {
    return {
      total_ingresos: "0.00",
      adr_promedio: "0.00",
      ocupacion_media_pct: "0.00",
      rn_totales: 0,
      rn_pickup_total: 0,
      revenue_pickup_total: "0.00",
      variacion_anual_pct: null,
    };
  }

  const clauses: string[] = ["anio = ?"];
  const params: unknown[] = [f.year];
  if (f.months && f.months.length > 0) {
    const ph = f.months.map(() => "?").join(",");
    clauses.push(`mes IN (${ph})`);
    params.push(...f.months);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const rows = await query<{ rev: string; adr: string; occ: string }>(
    `SELECT rev, adr, occ_pct AS occ
     FROM dashboard_monthly
     ${where}`,
    params
  );

  let totalRev = 0;
  let totalRn = 0;
  let occSum = 0;
  for (const r of rows) {
    const rev = num(r.rev);
    const adr = num(r.adr);
    totalRev += rev;
    if (adr > 0) totalRn += rev / adr; // RN estimado
    occSum += num(r.occ);
  }
  const adrPromedio = totalRn > 0 ? totalRev / totalRn : 0;
  const occMedia = rows.length > 0 ? occSum / rows.length : 0;

  return {
    total_ingresos: totalRev.toFixed(2),
    adr_promedio: adrPromedio.toFixed(2),
    ocupacion_media_pct: occMedia.toFixed(2),
    rn_totales: Math.round(totalRn),
    rn_pickup_total: 0,
    revenue_pickup_total: "0.00",
    variacion_anual_pct: null,
  };
}

// -----------------------------------------------------------------------------
// /api/dashboard/charts — 4 series
// -----------------------------------------------------------------------------
export async function getDashboardCharts(f: DashboardFilters) {
  const hasPickup = f.year ? await hasPickupData(f.year) : false;
  const [occAdr, pickup, mix, curva] = await Promise.all([
    getOccAdrSeries(f, hasPickup),
    getPickupSeries(f, hasPickup),
    getChannelMix(f),
    getCurvaPickup(f),
  ]);

  return {
    occ_adr_series: occAdr,
    pickup_series: pickup,
    channel_mix: mix,
    curva_pickup: curva,
    fuente: hasPickup ? "pickup_weekly" : "stly_sales+channel_sales_month",
    filtros_aplicados: f,
  };
}

/**
 * Serie OCC + ADR por mes.
 *  - Si pickup_weekly tiene data: usa pickup (semanal, agregado a mes)
 *  - Si no: usa channel_sales_month (revenue/RN por mes) + dashboard (OCC)
 */
async function getOccAdrSeries(f: DashboardFilters, hasPickup: boolean) {
  if (hasPickup && f.year) {
    return getOccAdrFromPickup(f);
  }
  return getOccAdrFromChannel(f);
}

/**
 * Serie OCC+ADR desde channel_sales_month + dashboard_monthly.
 * channel_sales da revenue/RN por mes (cálculo de ADR real).
 * dashboard da OCC por mes.
 */
async function getOccAdrFromChannel(f: DashboardFilters) {
  if (!f.year) return [];

  const clauses: string[] = ["csm.anio = ?"];
  const params: unknown[] = [f.year];
  if (f.months && f.months.length > 0) {
    const ph = f.months.map(() => "?").join(",");
    clauses.push(`csm.mes IN (${ph})`);
    params.push(...f.months);
  }
  if (f.channels && f.channels.length > 0) {
    const ph = f.channels.map(() => "?").join(",");
    clauses.push(`c.name IN (${ph})`);
    params.push(...f.channels);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;

  const rows = await query<{ mes: string; ingresos: string; rn: number }>(
    `SELECT
       csm.mes AS mes,
       SUM(csm.revenue_total) AS ingresos,
       SUM(csm.rn_total) AS rn
     FROM channel_sales_month csm
     JOIN channels c ON c.id = csm.channel_id
     ${where}
     GROUP BY csm.mes`,
    params
  );

  // OCC por mes desde dashboard_monthly
  const occRows = await query<{ mes: string; occ: string }>(
    `SELECT mes, occ_pct AS occ
     FROM dashboard_monthly
     WHERE anio = ?`,
    [f.year!]
  );
  const occByMes = new Map<string, number>();
  for (const o of occRows) {
    occByMes.set(String(o.mes), num(o.occ));
  }

  const byMes = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    byMes.set(String(r.mes), r);
  }
  return MESES_ORDEN.filter((m) => byMes.has(m)).map((mes) => {
    const r = byMes.get(mes)!;
    const ingresos = num(r.ingresos);
    const rn = Number(r.rn ?? 0);
    const adr = rn > 0 ? ingresos / rn : 0;
    return {
      mes,
      occ_pct: Math.round((occByMes.get(mes) ?? 0) * 100) / 100,
      adr: Math.round(adr * 100) / 100,
      ingresos: Math.round(ingresos * 100) / 100,
      rn,
    };
  });
}

async function getOccAdrFromPickup(f: DashboardFilters) {
  const clauses: string[] = ["anio = ?"];
  const params: unknown[] = [f.year];
  if (f.months && f.months.length > 0) {
    const ph = f.months.map(() => "?").join(",");
    clauses.push(`mes IN (${ph})`);
    params.push(...f.months);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;

  const rows = await query<{
    mes: string;
    occ_media: string;
    ingresos: string;
    rn: number;
  }>(
    `SELECT
       mes,
       AVG(occ_base_pct) AS occ_media,
       SUM(ingresos) AS ingresos,
       SUM(rn_base + rn_pickup) AS rn
     FROM pickup_weekly ${where}
     GROUP BY mes`,
    params
  );

  const byMes = new Map(rows.map((r) => [r.mes, r]));
  return MESES_ORDEN.filter((m) => byMes.has(m)).map((mes) => {
    const r = byMes.get(mes)!;
    const ingresos = num(r.ingresos);
    const rn = Number(r.rn ?? 0);
    const adr = rn > 0 ? ingresos / rn : 0;
    return {
      mes,
      occ_pct: Math.round(num(r.occ_media) * 100) / 100,
      adr: Math.round(adr * 100) / 100,
      ingresos: Math.round(ingresos * 100) / 100,
      rn,
    };
  });
}

async function getOccAdrFromStly(f: DashboardFilters) {
  if (!f.year) return [];

  const clauses: string[] = ["anio_mes = ?"];
  const params: unknown[] = [f.year];
  if (f.months && f.months.length > 0) {
    // stly_sales.mes viene como "Enero 2025" (con año). LIKE prefix.
    const likeClauses = f.months.map(() => "mes LIKE ?").join(" OR ");
    clauses.push(`(${likeClauses})`);
    params.push(...f.months.map((m) => `${m} %`));
  }
  if (f.channels && f.channels.length > 0) {
    const ph = f.channels.map(() => "?").join(",");
    clauses.push(
      `channel_id IN (SELECT id FROM channels WHERE name IN (${ph}))`
    );
    params.push(...f.channels);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;

  const rows = await query<{
    mes: string;
    ingresos: string;
    rn: number;
  }>(
    `SELECT
       mes,
       SUM(rev) AS ingresos,
       SUM(rn) AS rn
     FROM stly_sales ${where}
     GROUP BY mes`,
    params
  );

  // OCC por mes desde dashboard_monthly (mismo año)
  const occRows = await query<{ mes: string; occ: string; rev: string; adr: string }>(
    `SELECT mes, occ_pct AS occ, rev, adr
     FROM dashboard_monthly
     WHERE anio = ?`,
    [f.year!]
  );
  const occByMes = new Map<string, number>();
  const dashByMes = new Map<string, { rev: number; adr: number; occ: number }>();
  for (const o of occRows) {
    occByMes.set(String(o.mes), num(o.occ));
    dashByMes.set(String(o.mes), {
      rev: num(o.rev),
      adr: num(o.adr),
      occ: num(o.occ),
    });
  }

  // stly_sales.mes viene como "Enero 2024" (con año). Normalizamos al nombre
  // base del mes para hacer match con MESES_ORDEN.
  const byMes = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    const mesBase = String(r.mes).split(" ")[0];
    byMes.set(mesBase, r);
  }

  // Si stly no tiene meses pero dashboard sí, usar dashboard como fuente
  if (byMes.size === 0 && dashByMes.size > 0) {
    return MESES_ORDEN.filter((m) => dashByMes.has(m)).map((mes) => {
      const d = dashByMes.get(mes)!;
      const rn = d.adr > 0 ? d.rev / d.adr : 0;
      return {
        mes,
        occ_pct: Math.round(d.occ * 100) / 100,
        adr: Math.round(d.adr * 100) / 100,
        ingresos: Math.round(d.rev * 100) / 100,
        rn: Math.round(rn),
      };
    });
  }

  return MESES_ORDEN.filter((m) => byMes.has(m)).map((mes) => {
    const r = byMes.get(mes)!;
    const ingresos = num(r.ingresos);
    const rn = Number(r.rn ?? 0);
    const adr = rn > 0 ? ingresos / rn : 0;
    return {
      mes,
      occ_pct: Math.round((occByMes.get(mes) ?? 0) * 100) / 100,
      adr: Math.round(adr * 100) / 100,
      ingresos: Math.round(ingresos * 100) / 100,
      rn,
    };
  });
}

/**
 * Serie de pickup semanal — solo aplica si pickup_weekly tiene data del año.
 *
 * Si NO hay pickup, devuelve la serie MENSUAL del año actual (usando dashboard_monthly)
 * con un campo `es_pickup: false` para que el frontend pueda renderizar un chart alternativo.
 */
async function getPickupSeries(f: DashboardFilters, hasPickup: boolean) {
  if (!f.year) return [];

  if (hasPickup) {
    const clauses: string[] = ["anio = ?"];
    const params: unknown[] = [f.year];
    if (f.start_date) {
      clauses.push("fecha_reporte >= ?");
      params.push(f.start_date);
    }
    if (f.end_date) {
      clauses.push("fecha_reporte <= ?");
      params.push(f.end_date);
    }
    const where = `WHERE ${clauses.join(" AND ")}`;

    const rows = await query<{
      fecha_reporte: string;
      rn_pickup: number;
      revenue_pickup: string;
      occ_pickup_pp: string;
    }>(
      `SELECT fecha_reporte, rn_pickup, revenue_pickup, occ_pickup_pp
       FROM pickup_weekly ${where}
       ORDER BY fecha_reporte ASC`,
      params
    );

    return rows.map((r) => ({
      fecha_reporte: r.fecha_reporte,
      rn_pickup: Number(r.rn_pickup ?? 0),
      revenue_pickup: num(r.revenue_pickup),
      occ_pickup_pp: num(r.occ_pickup_pp),
    }));
  }

  // Sin pickup: devolver serie MENSUAL del año actual desde dashboard_monthly.
  // El frontend la renderiza como "Comparativo Anual" (1 línea por año disponible).
  const targetYear = f.year;
  const mesesNombres = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const mesesFiltro = f.months && f.months.length > 0 ? f.months : mesesNombres;

  // Devolvemos datos de TODOS los años <= al targetYear que tengan data
  const allAnios = [2023, 2024, 2025, 2026].filter((a) => a <= targetYear);
  const out: Array<{
    fecha_reporte: string;
    anio: number;
    mes: string;
    mes_num: number;
    rev: number;
    rn: number;
    occ: number;
  }> = [];

  for (const a of allAnios) {
    const ph = mesesFiltro.map(() => "?").join(",");
    const aRows = await query<{ mes: string; rev: string; adr: string; occ: string }>(
      `SELECT mes, rev, adr, occ_pct AS occ
       FROM dashboard_monthly
       WHERE anio = ? AND mes IN (${ph})`,
      [a, ...mesesFiltro]
    );
    for (const r of aRows) {
      const adr = num(r.adr);
      const rev = num(r.rev);
      const rn = adr > 0 ? rev / adr : 0;
      const mesNum = mesesNombres.indexOf(r.mes) + 1;
      out.push({
        fecha_reporte: `${a}-${String(mesNum).padStart(2, "0")}`,
        anio: a,
        mes: r.mes,
        mes_num: mesNum,
        rev,
        rn: Math.round(rn),
        occ: num(r.occ),
      });
    }
  }

  return out;
}

/**
 * Mix de canales — siempre desde channel_sales_month (tiene data 2023-2026).
 */
async function getChannelMix(f: DashboardFilters) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (f.year !== undefined) {
    clauses.push("csm.anio = ?");
    params.push(f.year);
  }
  if (f.months && f.months.length > 0) {
    const ph = f.months.map(() => "?").join(",");
    clauses.push(`csm.mes IN (${ph})`);
    params.push(...f.months);
  }
  if (f.channels && f.channels.length > 0) {
    const ph = f.channels.map(() => "?").join(",");
    clauses.push(`c.name IN (${ph})`);
    params.push(...f.channels);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const sql = `
    SELECT
      c.name AS canal,
      c.category AS categoria,
      SUM(csm.revenue_total) AS revenue,
      SUM(csm.rn_total) AS rn
    FROM channel_sales_month csm
    JOIN channels c ON c.id = csm.channel_id
    ${where}
    GROUP BY c.id, c.name, c.category
  `;
  const rows = await query<{
    canal: string;
    categoria: string;
    revenue: string;
    rn: number;
  }>(sql, params);

  const totalRev = rows.reduce((s, r) => s + num(r.revenue), 0) || 1;

  const out = rows.map((r) => {
    const rev = num(r.revenue);
    return {
      canal: r.canal,
      categoria: r.categoria,
      rn: Number(r.rn ?? 0),
      revenue: Math.round(rev * 100) / 100,
      participacion_pct: Math.round((rev / totalRev) * 10000) / 100,
    };
  });

  return out.sort((a, b) => b.revenue - a.revenue);
}

/**
 * Curva de pickup: año actual (pickup_weekly) vs año anterior (stly_sales).
 *
 * Si el año actual NO tiene pickup, devuelve la comparativa INTERANUAL
 * de Ingresos por mes (4 años × 12 meses) usando dashboard_monthly,
 * con `rn_stly` = revenue del año anterior y `delta_pct` calculado contra el año previo.
 */
async function getCurvaPickup(f: DashboardFilters) {
  if (!f.year) return [];
  const targetYear = f.year;
  const prevYear = targetYear - 1;

  const targetHasPickup = await hasPickupData(targetYear);
  if (targetHasPickup) {
    // Año actual: pickup_weekly por fecha_reporte
    const currentClauses: string[] = ["anio = ?"];
    const currentParams: unknown[] = [targetYear];
    if (f.start_date) {
      currentClauses.push("fecha_reporte >= ?");
      currentParams.push(f.start_date);
    }
    if (f.end_date) {
      currentClauses.push("fecha_reporte <= ?");
      currentParams.push(f.end_date);
    }

    const currentSql = `
      SELECT
        fecha_reporte,
        SUM(rn_base + rn_pickup) AS rn_total
      FROM pickup_weekly
      WHERE ${currentClauses.join(" AND ")}
      GROUP BY fecha_reporte
      ORDER BY fecha_reporte ASC
    `;
    const currentRows = await query<{ fecha_reporte: string; rn_total: number }>(
      currentSql,
      currentParams
    );

    const currentByWeek = new Map<number, number>();
    for (const r of currentRows) {
      const d = new Date(r.fecha_reporte);
      const wk = isoWeek(d);
      currentByWeek.set(wk, (currentByWeek.get(wk) ?? 0) + Number(r.rn_total ?? 0));
    }

    // Año anterior: stly_sales por semana_num
    const stlyClauses: string[] = ["anio_mes = ?"];
    const stlyParams: unknown[] = [prevYear];
    if (f.months && f.months.length > 0) {
      const likeClauses = f.months.map(() => "mes LIKE ?").join(" OR ");
      stlyClauses.push(`(${likeClauses})`);
      stlyParams.push(...f.months.map((m) => `${m} %`));
    }
    if (f.channels && f.channels.length > 0) {
      const ph = f.channels.map(() => "?").join(",");
      stlyClauses.push(`channel_id IN (SELECT id FROM channels WHERE name IN (${ph}))`);
      stlyParams.push(...f.channels);
    }

    const stlySql = `
      SELECT semana_num, SUM(rn) AS rn
      FROM stly_sales
      WHERE ${stlyClauses.join(" AND ")}
      GROUP BY semana_num
    `;
    const stlyRows = await query<{ semana_num: number; rn: number }>(
      stlySql,
      stlyParams
    );
    const stlyByWeek = new Map<number, number>();
    for (const r of stlyRows) {
      stlyByWeek.set(Number(r.semana_num), Number(r.rn ?? 0));
    }

    const allWeeks = Array.from(
      new Set<number>([...currentByWeek.keys(), ...stlyByWeek.keys()])
    ).sort((a, b) => a - b);

    return allWeeks.map((wk) => {
      const rnActual = currentByWeek.get(wk) ?? 0;
      const rnStly = stlyByWeek.get(wk) ?? 0;
      const delta = rnStly > 0 ? ((rnActual - rnStly) / rnStly) * 100 : 0;
      let fecha: string;
      try {
        fecha = dateFromIsoWeek(targetYear, wk, 1);
      } catch {
        fecha = `${targetYear}-01-01`;
      }
      return {
        semana_num: wk,
        fecha_semana: fecha,
        rn_actual: rnActual,
        rn_stly: rnStly,
        delta_pct: Math.round(delta * 100) / 100,
      };
    });
  }

  // Sin pickup: comparativa interanual de Ingresos (Revenue) por mes.
  // Eje X = mes (1..12). Compara el año actual con el año previo CON DATOS.
  const mesesNombres = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const mesesFiltro =
    f.months && f.months.length > 0
      ? f.months
      : mesesNombres;

  // Años con datos <= targetYear
  const aniosConDatos = [2023, 2024, 2025, 2026].filter((a) => a <= targetYear);

  // Año previo: el más reciente con datos (excluyendo el target)
  // Si el target es 2023 (sin año previo), usamos el más reciente disponible
  // para que la comparación siempre sea útil.
  const aniosParaComparar = aniosConDatos.filter((a) => a < targetYear);
  const anioComparado = aniosParaComparar.length > 0
    ? Math.max(...aniosParaComparar)
    : null;

  // Recolectar revenue por (anio, mes)
  const revByAnioMes = new Map<string, number>();
  for (const a of aniosConDatos) {
    const ph = mesesFiltro.map(() => "?").join(",");
    const rows = await query<{ mes: string; rev: string }>(
      `SELECT mes, rev FROM dashboard_monthly WHERE anio = ? AND mes IN (${ph})`,
      [a, ...mesesFiltro]
    );
    for (const r of rows) {
      revByAnioMes.set(`${a}-${r.mes}`, num(r.rev));
    }
  }

  // Devolvemos 1 punto por mes con rn_actual y rn_stly = año comparado
  return mesesFiltro.map((mes) => {
    const revActual = revByAnioMes.get(`${targetYear}-${mes}`) ?? 0;
    const revPrev = anioComparado !== null ? (revByAnioMes.get(`${anioComparado}-${mes}`) ?? 0) : 0;
    const delta = revPrev > 0 ? ((revActual - revPrev) / revPrev) * 100 : 0;
    const mesNum = mesesNombres.indexOf(mes) + 1;
    return {
      semana_num: mesNum,
      fecha_semana: `${targetYear}-${String(mesNum).padStart(2, "0")}`,
      anio_comparado: anioComparado,
      rn_actual: Math.round(revActual),
      rn_stly: Math.round(revPrev),
      delta_pct: Math.round(delta * 100) / 100,
    };
  });
}

// -----------------------------------------------------------------------------
// Helpers de fecha (ISO week number)
// -----------------------------------------------------------------------------
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function dateFromIsoWeek(year: number, week: number, weekday: number): string {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = new Date(simple);
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  ISOweekStart.setDate(ISOweekStart.getDate() + (weekday - 1));
  return ISOweekStart.toISOString().slice(0, 10);
}
