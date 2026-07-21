import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PickupRow {
  id: number;
  mes: string;
  anio: number;
  fecha_reporte: string;
  occ_base_pct: string;
  rn_base: number;
  ingresos: string;
  adr_base: string;
  occ_pickup_pp: string;
  rn_pickup: number;
  adr_pickup: string;
  revenue_pickup: string;
  source_file: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const year = sp.get("year") ? Number(sp.get("year")) : null;
    const mes = sp.get("mes");
    const limit = Math.min(Number(sp.get("limit") ?? 200), 2000);

    const clauses: string[] = [];
    const params: unknown[] = [];
    if (year) {
      clauses.push("anio = ?");
      params.push(year);
    }
    if (mes) {
      clauses.push("mes = ?");
      params.push(mes);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const rows = await query<PickupRow>(
      `SELECT id, mes, anio, fecha_reporte, occ_base_pct, rn_base, ingresos,
              adr_base, occ_pickup_pp, rn_pickup, adr_pickup, revenue_pickup, source_file
       FROM pickup_weekly
       ${where}
       ORDER BY fecha_reporte DESC
       LIMIT ${limit}`,
      params
    );
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[pickup GET]", e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const required = ["mes", "anio", "fecha_reporte", "occ_base_pct", "rn_base", "ingresos", "adr_base"];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null) {
        return NextResponse.json({ detail: `Missing field: ${k}` }, { status: 400 });
      }
    }

    // Buscar existente por (anio, mes, fecha_reporte) — UPSERT
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM pickup_weekly
       WHERE anio = ? AND mes = ? AND fecha_reporte = ?
       LIMIT 1`,
      [body.anio, body.mes, body.fecha_reporte]
    );

    if (existing) {
      await query(
        `UPDATE pickup_weekly
         SET occ_base_pct = ?, rn_base = ?, ingresos = ?, adr_base = ?,
             occ_pickup_pp = ?, rn_pickup = ?, adr_pickup = ?, revenue_pickup = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          body.occ_base_pct, body.rn_base, body.ingresos, body.adr_base,
          body.occ_pickup_pp ?? 0, body.rn_pickup ?? 0,
          body.adr_pickup ?? 0, body.revenue_pickup ?? 0,
          existing.id,
        ]
      );
      const updated = await queryOne<PickupRow>(
        `SELECT * FROM pickup_weekly WHERE id = ?`,
        [existing.id]
      );
      return NextResponse.json(updated, { status: 200 });
    }

    const result = await queryOne<{ id: number }>(
      `INSERT INTO pickup_weekly
        (mes, anio, fecha_reporte, occ_base_pct, rn_base, ingresos, adr_base,
         occ_pickup_pp, rn_pickup, adr_pickup, revenue_pickup)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.mes, body.anio, body.fecha_reporte, body.occ_base_pct, body.rn_base,
        body.ingresos, body.adr_base,
        body.occ_pickup_pp ?? 0, body.rn_pickup ?? 0,
        body.adr_pickup ?? 0, body.revenue_pickup ?? 0,
      ]
    );
    const created = await queryOne<PickupRow>(
      `SELECT * FROM pickup_weekly WHERE id = ?`,
      [result?.id]
    );
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("[pickup POST]", e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}
