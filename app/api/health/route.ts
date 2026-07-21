import { NextResponse } from "next/server";
import { ping } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbOk = await ping();
  return NextResponse.json({
    status: dbOk ? "ok" : "degraded",
    db_ok: dbOk,
    db_url_scheme: "mysql2",
    version: "1.0.0",
    runtime: "nextjs-api-route",
  });
}
