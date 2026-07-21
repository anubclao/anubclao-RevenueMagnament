import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { DashboardFilters } from "@/lib/filters";

export const dynamic = "force-dynamic";

const MESES_ORDEN = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

function parseFilters(req: NextRequest): DashboardFilters {
  const sp = req.nextUrl.searchParams;
  return {
    year: sp.get("year") ? Number(sp.get("year")) : undefined,
    months: sp.getAll("months").filter(Boolean),
    start_date: sp.get("start_date") ?? undefined,
    end_date: sp.get("end_date") ?? undefined,
    channels: sp.getAll("channels").filter(Boolean),
  };
}

interface Row {
  mes: string;
  anio: number;
  occ: number;
  adr: number;
  rev: number;
}

/**
 * TENDENCIA MENSUAL — Comparativo 2023 vs 2024 vs 2025 vs 2026 por mes.
 *
 * Devuelve 12 filas (una por mes) con OCC/ADR/REV para los 4 años.
 * Estructura: { mes, occ: {2023, 2024, 2025, 2026}, adr: {...}, rev: {...} }
 *
 * Si el usuario filtra `months=Enero,Febrero`, solo devuelve esos meses
 * (los demás quedan en null).
 *
 * Filtros:
 *  - year: año de referencia (afecta cuál es "el año actual" del comparativo)
 *  - months: lista de meses a incluir
 */
export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req);

    // Años a comparar: 2023..2026 (rango completo de la TENDENCIA MENSUAL)
    const anios = [2023, 2024, 2025, 2026];
    const ph = anios.map(() => "?").join(",");

    const rows = await query<Row>(
      `SELECT mes, anio, occ_pct AS occ, adr, rev
       FROM dashboard_monthly
       WHERE anio IN (${ph})`,
      anios
    );

    // Indexar por (anio, mes)
    const byAnioMes = new Map<string, Row>();
    for (const r of rows) {
      byAnioMes.set(`${r.anio}-${r.mes}`, r);
    }

    // Si el usuario filtra meses, respetamos el orden del filtro
    const mesesToShow = filters.months && filters.months.length > 0
      ? filters.months.filter((m) => MESES_ORDEN.includes(m as typeof MESES_ORDEN[number]))
      : [...MESES_ORDEN];

    // Calcular totales por año (para variación anual)
    const totalesPorAnio: Record<number, { rev: number; adr: number; occ: number; meses: number }> = {};
    for (const a of anios) {
      const m = MESES_ORDEN.map((mes) => byAnioMes.get(`${a}-${mes}`)).filter(Boolean) as Row[];
      const rev = m.reduce((s, r) => s + Number(r.rev ?? 0), 0);
      const rn = m.reduce((s, r) => s + (Number(r.adr ?? 0) > 0 ? Number(r.rev ?? 0) / Number(r.adr ?? 0) : 0), 0);
      const adr = rn > 0 ? rev / rn : 0;
      const occ = m.length > 0 ? m.reduce((s, r) => s + Number(r.occ ?? 0), 0) / m.length : 0;
      totalesPorAnio[a] = { rev, adr, occ, meses: m.length };
    }

    const data = mesesToShow.map((mes) => {
      const occ: Record<number, number | null> = {};
      const adr: Record<number, number | null> = {};
      const rev: Record<number, number | null> = {};
      for (const a of anios) {
        const r = byAnioMes.get(`${a}-${mes}`);
        if (r) {
          occ[a] = Number(r.occ);
          adr[a] = Number(r.adr);
          rev[a] = Number(r.rev);
        } else {
          occ[a] = null;
          adr[a] = null;
          rev[a] = null;
        }
      }
      return { mes, occ, adr, rev };
    });

    return NextResponse.json({
      anios,
      data,
      totales_por_anio: totalesPorAnio,
      filtros_aplicados: filters,
      fuente: "dashboard_monthly",
    });
  } catch (e) {
    console.error("[dashboard/tendencia-mensual]", e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}
