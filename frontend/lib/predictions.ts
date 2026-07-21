/**
 * predictions.ts — Port de predictions_service.py a TypeScript + mysql2.
 *
 * Genera proyecciones a partir de los datos reales (no del Excel).
 * 3 escenarios: OPTIMIST 1.10x, BASE 1.00x, PESSIMIST 0.90x.
 */
import { query } from "./db";

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

const SCENARIO_MULT: Record<string, number> = {
  OPTIMIST: 1.10,
  BASE: 1.00,
  PESSIMIST: 0.90,
};

interface MonthlyBase {
  mes: string;
  occ_pct: number;
  adr: number;
  rn: number;
  ingresos: number;
}

async function getMonthlyBase(year: number): Promise<MonthlyBase[]> {
  // Para cada mes, tomar el ÚLTIMO reporte de pickup_weekly (snapshot final)
  const sql = `
    SELECT mes, occ_base_pct, adr_base, rn_base, ingresos
    FROM pickup_weekly
    WHERE anio = ?
      AND fecha_reporte = (
        SELECT MAX(p2.fecha_reporte)
        FROM pickup_weekly p2
        WHERE p2.anio = ? AND p2.mes = pickup_weekly.mes
      )
  `;
  const rows = await query<{
    mes: string;
    occ_base_pct: string;
    adr_base: string;
    rn_base: number;
    ingresos: string;
  }>(sql, [year, year]);

  const byMes = new Map<string, MonthlyBase>();
  for (const r of rows) {
    byMes.set(r.mes, {
      mes: r.mes,
      occ_pct: num(r.occ_base_pct),
      adr: num(r.adr_base),
      rn: Number(r.rn_base ?? 0),
      ingresos: num(r.ingresos),
    });
  }

  // Asegurar 12 meses
  return MESES_ES.map((m) =>
    byMes.get(m) ?? { mes: m, occ_pct: 0, adr: 0, rn: 0, ingresos: 0 }
  );
}

async function getHistoricalTrend(year: number, mes: string) {
  // Compara (mes, year-1) con (mes, year-2) en channel_sales_month
  const sql1 = `
    SELECT AVG(adr_promedio) AS adr, SUM(rn_total) AS rn
    FROM channel_sales_month
    WHERE anio = ? AND mes = ?
  `;
  const sql2 = sql1; // mismo SQL, distintos params

  const [r1, r2] = await Promise.all([
    query<{ adr: string | null; rn: number | null }>(sql1, [year - 1, mes]),
    query<{ adr: string | null; rn: number | null }>(sql2, [year - 2, mes]),
  ]);

  const adr1 = r1[0]?.adr != null ? num(r1[0].adr) : null;
  const rn1 = r1[0]?.rn != null ? Number(r1[0].rn) : null;
  const adr2 = r2[0]?.adr != null ? num(r2[0].adr) : null;
  const rn2 = r2[0]?.rn != null ? Number(r2[0].rn) : null;

  if (adr1 === null || adr2 === null || rn1 === null || rn2 === null) {
    return { adr_delta: 0, rn_delta: 0 };
  }
  if (adr2 === 0 || rn2 === 0) {
    return { adr_delta: 0, rn_delta: 0 };
  }
  return {
    adr_delta: (adr1 - adr2) / adr2,
    rn_delta: (rn1 - rn2) / rn2,
  };
}

export async function generatePredictions(
  year: number,
  scenarios: string[] = ["OPTIMIST", "BASE", "PESSIMIST"]
) {
  const base = await getMonthlyBase(year);
  const out: Array<{
    mes: string;
    anio: number;
    scenario: string;
    occ_pct: number;
    adr: number;
    rn: number;
    rev: number;
  }> = [];

  for (const mb of base) {
    const trend = await getHistoricalTrend(year, mb.mes);
    for (const scen of scenarios) {
      const mult = SCENARIO_MULT[scen] ?? 1.0;
      const adr = mb.adr * (1 + trend.adr_delta) * mult;
      const rn = Math.round(mb.rn * (1 + trend.rn_delta) * mult);
      const rev = adr * rn;
      out.push({
        mes: mb.mes,
        anio: year,
        scenario: scen,
        occ_pct: mb.occ_pct,
        adr: Math.round(adr * 100) / 100,
        rn,
        rev: Math.round(rev * 100) / 100,
      });
    }
  }
  return out;
}

function num(x: unknown): number {
  if (x === null || x === undefined) return 0;
  return Number(x);
}
