// scripts/reload-dashboard.mjs
// Recarga dashboard_monthly desde el seed regenerado.
// Bug previo: comments dentro de VALUES con multipleStatements=true rompe.
// Fix: ejecutar DELETE y luego INSERT (sin comments intermedios) por separado.

import mysql from "mysql2/promise";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

// Cargar .env.local
const envPath = resolve(REPO_ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i+1).trim().replace(/^["']|["']$/g, "");
    if (k && !process.env[k]) process.env[k] = v;
  }
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  charset: "utf8mb4",
});

console.log("Recargando dashboard_monthly...");

// 1. DELETE
await conn.query("DELETE FROM dashboard_monthly WHERE anio IN (2023, 2024, 2025, 2026)");
console.log("  DELETE: OK");

// 2. INSERT — leer el Excel directamente con exceljs para evitar el bug de comments en SQL
const ExcelJS = (await import("exceljs")).default;
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(resolve(REPO_ROOT, "docs/BORA_BORA_Informe_Ejecutivo FINAL.xlsx"));
const dash = wb.getWorksheet("Dashboard");
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const rows = [];
for (let r = 13; r <= 24; r++) {
  const row = dash.getRow(r);
  const mes = String(row.getCell(2).value ?? "").trim();
  if (!mes || !MESES.includes(mes)) continue;
  for (let yi = 0; yi < 4; yi++) {
    const anio = 2023 + yi;
    const occ = row.getCell(3 + yi).value;
    const adr = row.getCell(7 + yi).value;
    const rev = row.getCell(11 + yi).value;
    if (occ === null && adr === null && rev === null) continue;
    rows.push({ anio, mes, occ: Number(occ) || 0, adr: Number(adr) || 0, rev: Number(rev) || 0 });
  }
}

console.log(`  INSERT: ${rows.length} filas`);
// Insertar en batch
const values = rows.map(r => `(${r.anio}, '${r.mes}', ${r.occ.toFixed(2)}, ${Math.round(r.adr)}, ${Math.round(r.rev)}, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx')`).join(",\n  ");
const insertSql = `INSERT INTO dashboard_monthly (anio, mes, occ_pct, adr, rev, source_file) VALUES\n  ${values}`;
const [res] = await conn.query(insertSql);
console.log(`  INSERT: ${res.affectedRows} filas afectadas`);

const [summary] = await conn.query("SELECT anio, COUNT(*) AS meses, ROUND(AVG(occ_pct),2) AS occ_media, ROUND(SUM(rev),0) AS rev_total FROM dashboard_monthly GROUP BY anio ORDER BY anio");
console.log("\n=== Resumen dashboard_monthly ===");
console.table(summary);

await conn.end();
console.log("\n✅ dashboard_monthly recargado desde el Excel actual.");
