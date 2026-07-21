import { NextRequest, NextResponse } from "next/server";
import { getDashboardCharts, type DashboardFilters } from "@/lib/filters";

export const dynamic = "force-dynamic";

function parseFilters(req: NextRequest): DashboardFilters {
  const sp = req.nextUrl.searchParams;
  return {
    year: sp.get("year") ? Number(sp.get("year")) : undefined,
    months: sp.getAll("months").filter(Boolean),
    start_date: sp.get("start_date") ?? undefined,
    end_date: sp.get("end_date") ?? undefined,
    channels: sp.getAll("channels").filter(Boolean),
    scenario: (sp.get("scenario") as DashboardFilters["scenario"]) ?? undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req);
    const charts = await getDashboardCharts(filters);
    return NextResponse.json(charts);
  } catch (e) {
    console.error("[dashboard/charts]", e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "internal error" },
      { status: 500 }
    );
  }
}
