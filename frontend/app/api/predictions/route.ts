import { NextRequest, NextResponse } from "next/server";
import { generatePredictions } from "@/lib/predictions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const yearStr = sp.get("year");
    if (!yearStr) {
      return NextResponse.json({ detail: "year is required" }, { status: 400 });
    }
    const year = Number(yearStr);
    if (year < 2020 || year > 2100) {
      return NextResponse.json({ detail: "year must be 2020-2100" }, { status: 400 });
    }
    const scenarios = sp.get("scenarios")
      ? sp.get("scenarios")!.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
      : ["OPTIMIST", "BASE", "PESSIMIST"];

    const rows = await generatePredictions(year, scenarios);
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[predictions GET]", e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}
