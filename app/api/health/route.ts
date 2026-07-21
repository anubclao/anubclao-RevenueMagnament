import { NextResponse } from "next/server";
import { ping } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbOk = await ping();

  // Diagnóstico: qué env vars ve el proceso (sin exponer passwords).
  // Si dbOk=false y todos los DB_* son "set", el problema es de credenciales/host.
  // Si dbOk=false y DB_HOST es "missing", el problema es que no se leyeron del panel.
  const envDiag = {
    DB_HOST: process.env.DB_HOST ? "set" : "missing",
    DB_PORT: process.env.DB_PORT ? "set" : "missing",
    DB_USER: process.env.DB_USER ? "set" : "missing",
    DB_PASS: process.env.DB_PASS ? "set" : "missing",
    DB_NAME: process.env.DB_NAME ? "set" : "missing",
    NODE_ENV: process.env.NODE_ENV ?? "missing",
  };
  const allSet = Object.values(envDiag).every((v) => v === "set" || v === "production");

  return NextResponse.json({
    status: dbOk ? "ok" : "degraded",
    db_ok: dbOk,
    db_url_scheme: "mysql2",
    runtime: "nextjs-api-route",
    version: "1.0.0",
    env: envDiag,
    env_all_set: allSet,
    built_at: new Date().toISOString(),
  });
}
