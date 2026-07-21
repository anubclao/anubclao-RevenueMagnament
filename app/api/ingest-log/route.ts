import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Number(sp.get("limit") ?? 20), 200);

    const rows = await query(
      `SELECT id, source_file, sheet_name, rows_inserted, rows_updated, rows_skipped, uploaded_at
       FROM ingest_log
       ORDER BY uploaded_at DESC
       LIMIT ${limit}`
    );
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[ingest-log GET]", e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}
