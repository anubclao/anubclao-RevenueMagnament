#!/usr/bin/env node
// scripts/regenerate-dashboard-seed.mjs
// Lee la hoja "Dashboard" del Excel FINAL y regenera docs/seed_dashboard.sql
// con los valores ACTUALIZADOS.
//
// Uso: node scripts/regenerate-dashboard-seed.mjs
// Output: docs/seed_dashboard.sql (overwrite)

import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(resolve(REPO_ROOT, "docs/BORA_BORA_Informe_Ejecutivo FINAL.xlsx"));
const dash = wb.getWorksheet("Dashboard");

if (!dash) {
  console.error("❌ No se encuentra la hoja 'Dashboard'");
  process.exit(1);
}

// Excel layout (rows 13-24):
//   col 2 (1-indexed) = Mes
//   cols 3-6 = OCC 23, OCC 24, OCC 25, OCC 26
//   cols 7-10 = ADR 23, ADR 24, ADR 25, ADR 26
//   cols 11-14 = REV 23, REV 24, REV 25, REV 26
function toDec(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[\s,$]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const rows = [];
for (let r = 13; r <= 24; r++) {
  const row = dash.getRow(r);
  const mes = String(row.getCell(2).value ?? "").trim();
  if (!mes) continue;
  if (!MESES.includes(mes)) continue;
  for (let yi = 0; yi < 4; yi++) {
    const anio = 2023 + yi;
    const occ = toDec(row.getCell(3 + yi).value);
    const adr = toDec(row.getCell(7 + yi).value);
    const rev = toDec(row.getCell(11 + yi).value);
    if (occ === null && adr === null && rev === null) continue;
    rows.push({ anio, mes, occ: occ ?? 0, adr: adr ?? 0, rev: rev ?? 0 });
  }
}

console.log(`Extraídos ${rows.length} registros de la hoja Dashboard.`);

let sql = `-- ===========================================================================
-- BORA BORA — Seed de TENDENCIA MENSUAL (hoja Dashboard del Excel FINAL)
-- GENERADO AUTOMÁTICAMENTE por scripts/regenerate-dashboard-seed.mjs
-- ${rows.length} registros = 12 meses × 4 años (2023-2026)
-- Carga OCC + ADR + Revenue históricos.
-- NO contiene CREATE DATABASE ni USE — DB-agnóstico (seleccionar DB en phpMyAdmin).
-- ===========================================================================

-- Idempotencia: si ya hay datos, los reemplaza
DELETE FROM dashboard_monthly WHERE anio IN (2023, 2024, 2025, 2026);

INSERT INTO dashboard_monthly (anio, mes, occ_pct, adr, rev, source_file) VALUES
`;

for (let yi = 0; yi < 4; yi++) {
  const anio = 2023 + yi;
  sql += `-- ==================== ${anio} ====================\n`;
  for (const mes of MESES) {
    const r = rows.find((x) => x.anio === anio && x.mes === mes);
    if (!r) continue;
    sql += `(${anio}, '${mes}', ${r.occ.toFixed(2)}, ${Math.round(r.adr)}, ${Math.round(r.rev)}, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),\n`;
  }
  sql += "\n";
}

// Quitar la última coma
sql = sql.replace(/,\n\n/, ";\n\n");

sql += `-- Verificación
SELECT anio, COUNT(*) AS meses, AVG(occ_pct) AS occ_media, SUM(rev) AS rev_total
FROM dashboard_monthly
GROUP BY anio
ORDER BY anio;
`;

const outPath = resolve(REPO_ROOT, "docs/seed_dashboard.sql");
writeFileSync(outPath, sql, "utf8");
console.log(`✅ Regenerado: ${outPath}`);
console.log(`   Registros: ${rows.length}`);
console.log(`   Tamaño: ${(sql.length / 1024).toFixed(2)} KB`);
