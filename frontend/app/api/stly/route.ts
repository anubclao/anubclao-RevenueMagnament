import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

interface StlyRow {
  id: number;
  semana_num: number;
  fecha_semana: string;
  mes: string;
  anio_mes: number;
  channel_id: number | null;
  rn: number;
  adr: string;
  rev: string;
  source_file: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const year = sp.get("year") ? Number(sp.get("year")) : null;
    const mes = sp.get("mes");
    const channelId = sp.get("channel_id") ? Number(sp.get("channel_id")) : null;
    const limit = Math.min(Number(sp.get("limit") ?? 500), 10000);

    const clauses: string[] = [];
    const params: unknown[] = [];
    if (year) {
      clauses.push("anio_mes = ?");
      params.push(year);
    }
    if (mes) {
      clauses.push("mes = ?");
      params.push(mes);
    }
    if (channelId) {
      clauses.push("channel_id = ?");
      params.push(channelId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const rows = await query<StlyRow>(
      `SELECT * FROM stly_sales
       ${where}
       ORDER BY fecha_semana DESC
       LIMIT ${limit}`,
      params
    );
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[stly GET]", e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const required = ["semana_num", "fecha_semana", "mes", "anio_mes"];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null) {
        return NextResponse.json({ detail: `Missing field: ${k}` }, { status: 400 });
      }
    }
    if (body.semana_num < 1 || body.semana_num > 200) {
      return NextResponse.json(
        { detail: "semana_num must be between 1 and 200" },
        { status: 400 }
      );
    }

    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM stly_sales
       WHERE fecha_semana = ? AND anio_mes = ? AND mes = ? AND channel_id ${body.channel_id == null ? "IS NULL" : "= ?"}
       LIMIT 1`,
      body.channel_id == null
        ? [body.fecha_semana, body.anio_mes, body.mes]
        : [body.fecha_semana, body.anio_mes, body.mes, body.channel_id]
    );

    if (existing) {
      await query(
        `UPDATE stly_sales
         SET semana_num = ?, rn = ?, adr = ?, rev = ?
         WHERE id = ?`,
        [body.semana_num, body.rn ?? 0, body.adr ?? 0, body.rev ?? 0, existing.id]
      );
      const updated = await queryOne<StlyRow>(`SELECT * FROM stly_sales WHERE id = ?`, [existing.id]);
      return NextResponse.json(updated, { status: 200 });
    }

    const result = await queryOne<{ id: number }>(
      `INSERT INTO stly_sales (semana_num, fecha_semana, mes, anio_mes, channel_id, rn, adr, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [body.semana_num, body.fecha_semana, body.mes, body.anio_mes, body.channel_id,
       body.rn ?? 0, body.adr ?? 0, body.rev ?? 0]
    );
    const created = await queryOne<StlyRow>(`SELECT * FROM stly_sales WHERE id = ?`, [result?.id]);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("[stly POST]", e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}
