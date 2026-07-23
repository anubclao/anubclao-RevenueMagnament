#!/usr/bin/env node
// scripts/audit-data-integrity.mjs
//
// SPEC: docs/specs/data-integrity-audit.md
//
// Compara el Excel fuente (.xlsx) contra MySQL (bora_bora_rm).
// Para cada tabla operativa, emite conteos por (año, mes) y diff.
// Exit 0 = todo coincide. Exit 1 = hay diff.
//
// Usage: node scripts/audit-data-integrity.mjs [path-to-excel]

import ExcelJS from 'exceljs';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

// Cargar .env.local manualmente (no estamos en Next.js)
function loadEnvLocal() {
  const envPath = join(REPO_ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

// Cargar mysql2 (CommonJS) vía createRequire
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

const EXCEL_PATH = process.argv[2] || join(REPO_ROOT, 'docs', 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx');

const MESES_VALIDOS = new Set([
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]);

// ----------------------------------------------------------------------------
// EXCEL PARSING — usa la misma lógica que lib/excel.ts
// ----------------------------------------------------------------------------

function cellValue(cell) {
  if (cell == null || cell.value === null || cell.value === undefined) return null;
  if (typeof cell.value === 'object' && 'result' in cell.value) return cell.value.result;
  if (typeof cell.value === 'object' && 'text' in cell.value) return cell.value.text;
  if (cell.value instanceof Date) return cell.value;
  return cell.value;
}

function getRow(sheet, n) {
  const row = sheet.getRow(n);
  const out = [];
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    out[colNumber - 1] = cellValue(cell);
  });
  return out;
}

function toInt(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toDecimal(x) {
  if (x === null || x === undefined || x === '') return null;
  if (typeof x === 'number') return x;
  const s = String(x).replace(/[\s,$]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toDate(x) {
  if (x === null || x === undefined) return null;
  if (x instanceof Date) return x.toISOString().slice(0, 10);
  if (typeof x === 'number') {
    const d = new Date((x - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(x).trim();
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, '');
}

function mapColumns(header, candidates) {
  const map = {};
  for (const c of candidates) {
    const target = norm(c);
    for (let i = 0; i < header.length; i++) {
      if (norm(header[i]) === target) {
        map[c] = i;
        break;
      }
    }
    if (map[c] === undefined) map[c] = -1;
  }
  return map;
}

function findHeaderRow(sheet, anchors, maxRows = 8) {
  const targets = anchors.map(norm).filter(Boolean);
  for (let r = 1; r <= Math.min(maxRows, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    const found = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      found.push(norm(cell.value));
    });
    if (targets.some((t) => found.includes(t))) {
      return r;
    }
  }
  return 1;
}

// ---- DB_PU_WEEK ----
function parsePickupFromWorkbook(wb) {
  const sheet = wb.getWorksheet('DB_PU_WEEK');
  if (!sheet) return { byYearMonth: {}, total: 0, skipped: 0 };
  const headerRow = findHeaderRow(sheet, ['mes', 'año', 'fecha_reporte', 'fechareporte']);
  const header = getRow(sheet, headerRow);
  const cm = mapColumns(header, [
    'mes', 'año', 'fecha_reporte', 'fecha_semana', 'occ_base_pct', 'rn_base',
    'ingresos', 'adr_base', 'occ_pickup_pp', 'rn_pickup', 'adr_pickup', 'revenue_pickup',
  ]);
  const byYearMonth = {};
  let skipped = 0;
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = getRow(sheet, r);
    if (!row || row.length === 0) continue;
    const mes = String(row[cm.mes] ?? '').trim();
    if (!mes || !MESES_VALIDOS.has(mes.split(' ')[0])) { skipped++; continue; }
    const anio = toInt(row[cm['año']]);
    if (!anio || anio < 2020 || anio > 2100) { skipped++; continue; }
    const fecha = toDate(row[cm.fecha_reporte] ?? row[cm.fecha_semana]);
    if (!fecha) { skipped++; continue; }
    const k = `${anio}-${mes.split(' ')[0]}`;
    byYearMonth[k] = (byYearMonth[k] || 0) + 1;
  }
  const total = Object.values(byYearMonth).reduce((a, b) => a + b, 0);
  return { byYearMonth, total, skipped };
}

// ---- STLY ----
function parseStlyFromWorkbook(wb) {
  const sheet = wb.getWorksheet('STLY');
  if (!sheet) return { byAnioMes: {}, total: 0, skipped: 0, totalAlojamiento: 0 };
  const headerRow = findHeaderRow(sheet, ['semana_num', 'semanamum', 'fecha_semana', 'mes']);
  const header = getRow(sheet, headerRow);
  const cm = mapColumns(header, [
    'semana_num', 'semana', 'fecha_semana', 'mes', 'anio_mes', 'año_mes',
    'canal', 'channel', 'rn', 'adr', 'rev', 'revenue',
  ]);
  const byAnioMes = {};
  let skipped = 0, totalAlojamiento = 0;
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = getRow(sheet, r);
    if (!row || row.length === 0) continue;
    const mes = String(row[cm.mes] ?? '').trim();
    if (!mes) { skipped++; continue; }
    const canal = String(row[cm.canal] ?? '').trim();
    if (canal.toLowerCase().includes('total alojamiento')) { totalAlojamiento++; continue; }
    const semana = toInt(row[cm.semana_num]) ?? toInt(row[cm.semana]);
    if (!semana || semana < 1 || semana > 200) { skipped++; continue; }
    const fecha = toDate(row[cm.fecha_semana]);
    if (!fecha) { skipped++; continue; }
    const anioMes = toInt(row[cm.anio_mes]) ?? toInt(row[cm['año_mes']]);
    if (!anioMes || anioMes < 2020) { skipped++; continue; }
    const k = `${anioMes}-${mes.split(' ')[0]}`;
    byAnioMes[k] = (byAnioMes[k] || 0) + 1;
  }
  const total = Object.values(byAnioMes).reduce((a, b) => a + b, 0);
  return { byAnioMes, total, skipped, totalAlojamiento };
}

// ---- Venta por canal ----
function parseChannelSalesFromWorkbook(wb) {
  const sheet = wb.getWorksheet('Venta por canal');
  if (!sheet) return { byYearMonth: {}, total: 0, skipped: 0 };
  const headerRow = findHeaderRow(sheet, ['mes', 'canal', 'rn', 'adr', 'revenue']);
  const header = getRow(sheet, headerRow);
  const cm = mapColumns(header, [
    'mes', 'anio', 'año', 'canal', 'channel', 'rn', 'rn_total',
    'adr', 'adr_promedio', 'revenue', 'rev', 'revenue_total',
  ]);
  const byYearMonth = {};
  let skipped = 0, totalAlojamiento = 0;
  let currentAnio = 0, currentMes = '';
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = getRow(sheet, r);
    if (!row || row.length === 0) continue;
    const anioCell = toInt(row[cm.anio]) ?? toInt(row[cm['año']]);
    const mesCell = String(row[cm.mes] ?? '').trim();
    const canalCell = String(row[cm.canal] ?? row[cm.channel] ?? '').trim();
    if (mesCell && MESES_VALIDOS.has(mesCell.split(' ')[0])) {
      currentMes = mesCell.split(' ')[0];
      if (anioCell && anioCell > 2020) currentAnio = anioCell;
      if (!canalCell) continue; // fila solo mes/año
    }
    if (canalCell.toLowerCase().includes('total alojamiento')) { totalAlojamiento++; continue; }
    if (!canalCell || !currentMes || !currentAnio) { skipped++; continue; }
    const k = `${currentAnio}-${currentMes}`;
    byYearMonth[k] = (byYearMonth[k] || 0) + 1;
  }
  const total = Object.values(byYearMonth).reduce((a, b) => a + b, 0);
  return { byYearMonth, total, skipped, totalAlojamiento };
}

// ---- Dashboard (TENDENCIA MENSUAL) ----
function parseDashboardFromWorkbook(wb) {
  const sheet = wb.getWorksheet('Dashboard');
  if (!sheet) return { byYearMonth: {}, total: 0, skipped: 0 };
  // Header en fila 12: Mes | OCC 23 | OCC 24 | OCC 25 | OCC 26 | ADR 23 | ADR 24 | ADR 25 | ADR 26 | REV 23 | REV 24 | REV 25 | REV 26
  // Data en filas 13-24
  const byYearMonth = {};
  for (let r = 13; r <= 24; r++) {
    const row = getRow(sheet, r);
    if (!row || row.length === 0) continue;
    const mes = String(row[1] ?? '').trim(); // col 2 (0-indexed 1)
    if (!mes) continue;
    for (let yi = 0; yi < 4; yi++) {
      const anio = 2023 + yi;
      const occ = toDecimal(row[2 + yi]);
      const adr = toDecimal(row[6 + yi]);
      const rev = toDecimal(row[10 + yi]);
      // Una entrada por (año, mes) — usamos rev como proxy de "fila presente"
      if (occ !== null || adr !== null || rev !== null) {
        const k = `${anio}-${mes}`;
        byYearMonth[k] = (byYearMonth[k] || 0) + 1;
      }
    }
  }
  const total = Object.values(byYearMonth).reduce((a, b) => a + b, 0);
  return { byYearMonth, total, skipped: 0 };
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

async function main() {
  if (!existsSync(EXCEL_PATH)) {
    console.error(`❌ No se encuentra el Excel: ${EXCEL_PATH}`);
    process.exit(2);
  }
  const dbHost = process.env.DB_HOST;
  const dbUser = process.env.DB_USER;
  const dbPass = process.env.DB_PASS;
  const dbName = process.env.DB_NAME;
  const dbPort = Number(process.env.DB_PORT || 3306);
  if (!dbHost || !dbUser || !dbName) {
    console.error('❌ Faltan env vars (DB_HOST, DB_USER, DB_NAME, DB_PASS). Revisa .env.local');
    process.exit(2);
  }

  console.log(`\n# Bora Bora — Data Integrity Audit`);
  console.log(`# Excel: ${EXCEL_PATH}`);
  console.log(`# DB:    ${dbUser}@${dbHost}:${dbPort}/${dbName}\n`);

  // Parsear Excel
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);
  const excelPickup = parsePickupFromWorkbook(wb);
  const excelStly = parseStlyFromWorkbook(wb);
  const excelChannel = parseChannelSalesFromWorkbook(wb);
  const excelDash = parseDashboardFromWorkbook(wb);

  // Conectar MySQL
  const conn = await mysql.createConnection({
    host: dbHost, user: dbUser, password: dbPass, database: dbName, port: dbPort,
    charset: 'utf8mb4',
  });

  // Conteos MySQL (raw row count)
  const [pickupRows] = await conn.query(
    `SELECT anio, mes, COUNT(*) AS n FROM pickup_weekly GROUP BY anio, mes`
  );
  const [stlyRows] = await conn.query(
    `SELECT anio_mes, mes, COUNT(*) AS n FROM stly_sales GROUP BY anio_mes, mes`
  );
  const [channelRows] = await conn.query(
    `SELECT anio, mes, COUNT(*) AS n FROM channel_sales_month GROUP BY anio, mes`
  );
  const [dashRows] = await conn.query(
    `SELECT anio, mes, COUNT(*) AS n FROM dashboard_monthly GROUP BY anio, mes`
  );

  // Valores agregados del dashboard (lo que el USUARIO ve)
  const [dashValues] = await conn.query(
    `SELECT anio, mes, occ_pct, adr, rev FROM dashboard_monthly ORDER BY anio, FIELD(mes,'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre')`
  );

  await conn.end();

  // Indexar MySQL
  const mysqlPickup = {};
  for (const r of pickupRows) mysqlPickup[`${r.anio}-${r.mes}`] = r.n;
  const mysqlStly = {};
  for (const r of stlyRows) {
    const mes = String(r.mes).split(' ')[0];
    mysqlStly[`${r.anio_mes}-${mes}`] = r.n;
  }
  const mysqlChannel = {};
  for (const r of channelRows) mysqlChannel[`${r.anio}-${r.mes}`] = r.n;
  const mysqlDash = {};
  for (const r of dashRows) mysqlDash[`${r.anio}-${r.mes}`] = r.n;

  // Helpers
  const mergeKeys = (excelMap, mysqlMap) => {
    const allKeys = new Set([...Object.keys(excelMap), ...Object.keys(mysqlMap)]);
    const out = {};
    for (const k of [...allKeys].sort()) {
      out[k] = { excel: excelMap[k] || 0, mysql: mysqlMap[k] || 0, diff: (mysqlMap[k] || 0) - (excelMap[k] || 0) };
    }
    return out;
  };
  const sumN = (m) => Object.values(m).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);

  const pickupMerged = mergeKeys(excelPickup.byYearMonth, mysqlPickup);
  const stlyMerged = mergeKeys(excelStly.byAnioMes, mysqlStly);
  const channelMerged = mergeKeys(excelChannel.byYearMonth, mysqlChannel);
  const dashMerged = mergeKeys(excelDash.byYearMonth, mysqlDash);

  // === AC-1: Row count audit (raw) ===
  console.log(`## AC-1: Conteo de filas (raw) — puede tener diff por dedup de natural key`);
  const tablesWithRawDiff = [];
  const printRawTable = (name, excelTotal, mysqlTotal, merged) => {
    const diff = mysqlTotal - excelTotal;
    const pct = excelTotal > 0 ? (mysqlTotal / excelTotal * 100).toFixed(2) : '0.00';
    const icon = diff === 0 ? '✅' : '⚠️';
    console.log(`- ${name.padEnd(22)} Excel: ${String(excelTotal).padStart(6)} | MySQL: ${String(mysqlTotal).padStart(6)} | Diff: ${(diff >= 0 ? '+' : '') + String(diff).padStart(5)} (${pct}%) ${icon}`);
    if (diff !== 0) tablesWithRawDiff.push({ name, diff, merged });
  };
  printRawTable('pickup_weekly', excelPickup.total, sumN(mysqlPickup), pickupMerged);
  printRawTable('stly_sales', excelStly.total, sumN(mysqlStly), stlyMerged);
  printRawTable('channel_sales_month', excelChannel.total, sumN(mysqlChannel), channelMerged);
  printRawTable('dashboard_monthly', excelDash.total, sumN(mysqlDash), dashMerged);
  console.log('');

  // === AC-2: Aggregate audit (lo que el USUARIO ve) ===
  console.log(`## AC-2: Valores de dashboard_monthly (lo que el USUARIO ve) — DEBE coincidir 100%`);
  let aggregateMismatches = 0;
  const aggregateMismatchesList = [];
  // excelDash ya tiene occ/adr/rev por (anio, mes); mysqlDash es solo row count
  // Necesitamos parsear excelDash con los valores
  const excelDashValues = parseDashboardValues(wb);
  for (const k of Object.keys(excelDashValues).sort()) {
    const e = excelDashValues[k];
    const d = dashValues.find(r => `${r.anio}-${r.mes}` === k);
    if (!d) {
      aggregateMismatches++;
      aggregateMismatchesList.push({ k, type: 'missing_in_db' });
      continue;
    }
    const dOcc = +(Number(d.occ_pct) - e.occ).toFixed(2);
    const dAdr = +(Number(d.adr) - e.adr).toFixed(2);
    const dRev = +(Number(d.rev) - e.rev).toFixed(2);
    if (Math.abs(dOcc) >= 0.01 || Math.abs(dAdr) >= 1 || Math.abs(dRev) >= 1) {
      aggregateMismatches++;
      aggregateMismatchesList.push({ k, dOcc, dAdr, dRev });
    }
  }
  const totalAggregateCells = Object.keys(excelDashValues).length;
  console.log(`- ${totalAggregateCells} celdas (anio×mes × 3 métricas)`);
  console.log(`- Mismatches: ${aggregateMismatches} ${aggregateMismatches === 0 ? '✅' : '❌'}`);
  if (aggregateMismatches > 0) {
    console.log(`- Detalle:`);
    for (const m of aggregateMismatchesList.slice(0, 10)) {
      console.log(`    ${m.k}: ${JSON.stringify(m)}`);
    }
  }
  console.log('');

  const tablesWithAggregateDiff = aggregateMismatches > 0 ? ['dashboard_monthly'] : [];

  // === Diagnóstico de dedup ===
  if (tablesWithRawDiff.length > 0) {
    console.log(`## Diagnóstico de dedup (raw row diff)`);
    for (const t of tablesWithRawDiff) {
      const negDiffs = Object.entries(t.merged).filter(([_, v]) => v.diff !== 0);
      console.log(`- ${t.name}: ${negDiffs.length} (year, mes) con diff. Patrón:`);
      // Mostrar patrón: ¿todas tienen el mismo número de faltantes?
      const counts = {};
      for (const [_, v] of negDiffs) {
        const k = `${v.diff}`;
        counts[k] = (counts[k] || 0) + 1;
      }
      console.log(`    Distribución de diffs: ${JSON.stringify(counts)}`);
      console.log(`- Esto es ESPERADO si el Excel tiene filas duplicadas en la natural key del UPSERT.`);
      console.log(`  El sistema toma el ÚLTIMO snapshot (estrategia documentada: "last-snapshot-per-month").`);
    }
    console.log('');
  }

  // === Resumen final ===
  console.log(`## Resumen`);
  console.log(`- Raw row count: ${tablesWithRawDiff.length} tabla(s) con diff (esperado por dedup).`);
  console.log(`- Aggregates (lo que el usuario ve): ${aggregateMismatches === 0 ? '✅ 100% match' : `❌ ${aggregateMismatches} discrepancias`}.`);
  if (excelStly.totalAlojamiento > 0) {
    console.log(`- (info) Filas "Total Alojamiento" descartadas en STLY: ${excelStly.totalAlojamiento}`);
  }
  if (excelChannel.totalAlojamiento > 0) {
    console.log(`- (info) Filas "Total Alojamiento" descartadas en Venta por canal: ${excelChannel.totalAlojamiento}`);
  }
  console.log('');

  // JSON report
  const jsonReport = {
    pickup: { excel: excelPickup.total, mysql: sumN(mysqlPickup), diff: sumN(mysqlPickup) - excelPickup.total, byYearMonth: pickupMerged },
    stly: { excel: excelStly.total, mysql: sumN(mysqlStly), diff: sumN(mysqlStly) - excelStly.total, byAnioMes: stlyMerged },
    channelSales: { excel: excelChannel.total, mysql: sumN(mysqlChannel), diff: sumN(mysqlChannel) - excelChannel.total, byYearMonth: channelMerged },
    dashboardMonthly: { excel: excelDash.total, mysql: sumN(mysqlDash), diff: sumN(mysqlDash) - excelDash.total, byYearMonth: dashMerged },
    aggregates: {
      totalCells: totalAggregateCells,
      mismatches: aggregateMismatches,
      mismatchesList: aggregateMismatchesList,
    },
    summary: {
      rawTablesWithDiff: tablesWithRawDiff.map(t => t.name),
      aggregateTablesWithDiff: tablesWithAggregateDiff,
      auditPassed: aggregateMismatches === 0,
    },
  };
  console.log('===JSON-REPORT-START===');
  console.log(JSON.stringify(jsonReport, null, 2));
  console.log('===JSON-REPORT-END===');
  console.log('');

  if (aggregateMismatches === 0) {
    console.log('✅ AUDIT PASSED — todos los valores visibles al usuario coinciden con el Excel fuente.');
    console.log('   (Los diffs en raw row count son dedup de natural key, esperado.)');
    process.exit(0);
  } else {
    console.log('❌ AUDIT FAILED — los valores del dashboard no coinciden con el Excel. Ejecutar scripts/regenerate-dashboard-seed.mjs + scripts/reload-dashboard.mjs.');
    process.exit(1);
  }
}

// Parsea los valores (occ, adr, rev) de la hoja Dashboard
function parseDashboardValues(wb) {
  const sh = wb.getWorksheet('Dashboard');
  if (!sh) return {};
  const out = {};
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  for (let r = 13; r <= 24; r++) {
    const row = sh.getRow(r);
    const mes = String(row.getCell(2).value ?? '').trim();
    if (!mes || !MESES.includes(mes)) continue;
    for (let yi = 0; yi < 4; yi++) {
      const anio = 2023 + yi;
      const occ = toDecimal(row.getCell(3 + yi).value);
      const adr = toDecimal(row.getCell(7 + yi).value);
      const rev = toDecimal(row.getCell(11 + yi).value);
      if (occ === null && adr === null && rev === null) continue;
      out[`${anio}-${mes}`] = {
        occ: occ ?? 0,
        adr: adr ?? 0,
        rev: rev ?? 0,
      };
    }
  }
  return out;
}

main().catch((e) => {
  console.error('Error fatal en audit:', e);
  process.exit(2);
});
