import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ChannelRow {
  id: number;
  name: string;
  display_name: string;
  category: string;
  is_active: number;
  sort_order: number;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const activeOnly = sp.get("active_only") !== "false";
    const category = sp.get("category");

    const clauses: string[] = [];
    const params: unknown[] = [];
    if (activeOnly) clauses.push("is_active = TRUE");
    if (category) {
      clauses.push("category = ?");
      params.push(category);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const rows = await query<ChannelRow>(
      `SELECT id, name, display_name, category, is_active, sort_order
       FROM channels
       ${where}
       ORDER BY sort_order, name`,
      params
    );
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[channels GET]", e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}
