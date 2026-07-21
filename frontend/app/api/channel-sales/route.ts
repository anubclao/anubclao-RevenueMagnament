import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ChannelSalesRow {
  id: number;
  anio: number;
  mes: string;
  channel_id: number;
  rn_total: number;
  adr_promedio: string | null;
  revenue_total: string;
  channel_name: string;
  channel_category: string;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const year = sp.get("year") ? Number(sp.get("year")) : null;
    const mes = sp.get("mes");
    const channelId = sp.get("channel_id") ? Number(sp.get("channel_id")) : null;
    const limit = Math.min(Number(sp.get("limit") ?? 500), 5000);

    const clauses: string[] = [];
    const params: unknown[] = [];
    if (year) {
      clauses.push("csm.anio = ?");
      params.push(year);
    }
    if (mes) {
      clauses.push("csm.mes = ?");
      params.push(mes);
    }
    if (channelId) {
      clauses.push("csm.channel_id = ?");
      params.push(channelId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const rows = await query<ChannelSalesRow>(
      `SELECT csm.id, csm.anio, csm.mes, csm.channel_id,
              csm.rn_total, csm.adr_promedio, csm.revenue_total,
              c.name AS channel_name, c.category AS channel_category
       FROM channel_sales_month csm
       JOIN channels c ON c.id = csm.channel_id
       ${where}
       ORDER BY csm.anio DESC, csm.mes, c.sort_order
       LIMIT ${limit}`,
      params
    );
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[channel-sales GET]", e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}
