// scripts/audit-source.mjs — v2 corregido
// Columnas reales: header en fila 4: [Año, Mes, Canal, RN Total, ADR Promedio, Revenue Total]
// Excel usa 1-indexed; col 2 = Año, col 3 = Mes, col 4 = Canal
import ExcelJS from "exceljs";

const FILE = process.argv[2] || "docs/BORA_BORA_Informe_Ejecutivo FINAL.xlsx";

const MESES_VALIDOS = new Set([
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]);

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);

function countByYearMonth(sheet, config) {
  const counts = {};
  let totalAlojamiento = 0;
  let skipped = 0;
  let currentAnio = 0;
  let currentMes = "";
  for (let r = config.headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const anioCell = row.getCell(config.anioCol).value;
    const mesCell = String(row.getCell(config.mesCol).value ?? "").trim();
    const canalCell = String(row.getCell(config.canalCol).value ?? "").trim();

    if (mesCell && MESES_VALIDOS.has(mesCell.split(" ")[0])) {
      currentMes = mesCell.split(" ")[0];
      if (anioCell && typeof anioCell === "number" && anioCell > 2020) currentAnio = anioCell;
      if (!canalCell) continue; // fila solo con mes/año
    }
    if (canalCell.toLowerCase().includes("total alojamiento")) {
      totalAlojamiento++;
      continue;
    }
    if (!canalCell || !currentMes || !currentAnio) {
      skipped++;
      continue;
    }
    const k = `${currentAnio}-${currentMes}`;
    counts[k] = (counts[k] || 0) + 1;
  }
  return { counts, totalAlojamiento, skipped };
}

const result = {};

// DB_PU_WEEK
const pickup = wb.getWorksheet("DB_PU_WEEK");
if (pickup) {
  const counts = {};
  let skipped = 0;
  for (let r = 2; r <= pickup.rowCount; r++) {
    const row = pickup.getRow(r);
    const mes = String(row.getCell(1).value ?? "").trim();
    const anio = row.getCell(2).value;
    if (mes && MESES_VALIDOS.has(mes.split(" ")[0]) && anio && typeof anio === "number") {
      const k = `${anio}-${mes.split(" ")[0]}`;
      counts[k] = (counts[k] || 0) + 1;
    } else if (mes || anio) {
      skipped++;
    }
  }
  result.pickup = { counts, skipped };
}

// STLY
const stly = wb.getWorksheet("STLY");
if (stly) {
  const r = countByYearMonth(stly, { headerRow: 1, anioCol: 4, mesCol: 3, canalCol: 5 });
  result.stly = r;
}

// Venta por canal
const vc = wb.getWorksheet("Venta por canal");
if (vc) {
  const r = countByYearMonth(vc, { headerRow: 4, anioCol: 2, mesCol: 3, canalCol: 4 });
  result.channelSales = r;
}

console.log(JSON.stringify(result, null, 2));
