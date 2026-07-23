// scripts/audit-aggregates.mjs
// Compara los VALORES del Excel Dashboard sheet (TENDENCIA MENSUAL) vs DB dashboard_monthly
// Esto es lo que el USUARIO ve en la UI — la integridad REAL.
import ExcelJS from "exceljs";
import mysql from "mysql2/promise";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = __dirname.replace(/scripts[\\\/]$/, "");
loadEnvLocal();

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function loadEnvLocal() {
  const envPath = `${REPO_ROOT}.env.local`;
  if (!existsSync(envPath)) return;
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

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(`${REPO_ROOT}docs/BORA_BORA_Informe_Ejecutivo FINAL.xlsx`);
const dash = wb.getWorksheet("Dashboard");

// Excel rows 13-24: col 2=mes, 3-6=OCC 23-26, 7-10=ADR 23-26, 11-14=REV 23-26
// (data col 1 is empty due to merged title above; so use 0-indexed 1..13)
const excelData = {};
for (let r = 13; r <= 24; r++) {
  const row = dash.getRow(r);
  const mes = String(row.getCell(2).value ?? "").trim();
  if (!mes) continue;
  for (let yi = 0; yi < 4; yi++) {
    const anio = 2023 + yi;
    excelData[`${anio}-${mes}`] = {
      occ: row.getCell(3 + yi).value,
      adr: row.getCell(7 + yi).value,
      rev: row.getCell(11 + yi).value,
    };
  }
}

// DB
const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  charset: "utf8mb4",
});
const [rows] = await conn.query(`SELECT anio, mes, occ_pct, adr, rev FROM dashboard_monthly ORDER BY anio, FIELD(mes,'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre')`);
await conn.end();

const dbData = {};
for (const r of rows) dbData[`${r.anio}-${r.mes}`] = { occ: Number(r.occ_pct), adr: Number(r.adr), rev: Number(r.rev) };

// Comparar
console.log("=== DASHBOARD MONTHLY — Excel vs DB (lo que el USUARIO ve) ===\n");
console.log("Año-Mes       | OCC_excel OCC_db   Δ      | ADR_excel       ADR_db          Δ       | REV_excel         REV_db            Δ");
console.log("-".repeat(150));
let mismatches = 0;
for (const k of Object.keys(excelData).sort()) {
  const e = excelData[k], d = dbData[k];
  if (!d) {
    console.log(`${k.padEnd(12)}  | (no existe en DB)`);
    mismatches++;
    continue;
  }
  const dOcc = +(d.occ - Number(e.occ)).toFixed(2);
  const dAdr = +(d.adr - Number(e.adr)).toFixed(2);
  const dRev = +(d.rev - Number(e.rev)).toFixed(2);
  const ok = Math.abs(dOcc) < 0.05 && Math.abs(dAdr) < 1 && Math.abs(dRev) < 1;
  if (!ok) mismatches++;
  const marker = ok ? "✓" : "✗";
  console.log(
    `${k.padEnd(13)} | ${String(Number(e.occ).toFixed(2)).padStart(9)} ${String(d.occ.toFixed(2)).padStart(9)} ${dOcc >= 0 ? "+" : ""}${dOcc.toFixed(2)} ${marker} | ${String(Math.round(Number(e.adr))).padStart(13)} ${String(Math.round(d.adr)).padStart(13)} ${dAdr >= 0 ? "+" : ""}${dRev.toFixed(0)} | ${String(Math.round(Number(e.rev))).padStart(15)} ${String(Math.round(d.rev)).padStart(15)} ${dRev >= 0 ? "+" : ""}${dRev.toFixed(0)}`
  );
}
console.log(`\n${mismatches === 0 ? "✅ AGGREGATES MATCH" : `❌ ${mismatches} discrepancias en agregados`}`);
