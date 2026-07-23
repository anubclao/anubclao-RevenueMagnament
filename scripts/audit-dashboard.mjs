// scripts/audit-dashboard.mjs
// Compara el sheet "Dashboard" (TENDENCIA MENSUAL) vs tabla dashboard_monthly
import ExcelJS from "exceljs";

const FILE = "docs/BORA_BORA_Informe_Ejecutivo FINAL.xlsx";
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);
const dash = wb.getWorksheet("Dashboard");

// Filas 13-24 = Enero-Diciembre
// R12 es header: Mes | OCC 23 | OCC 24 | OCC 25 | OCC 26 | ADR 23 | ADR 24 | ADR 25 | ADR 26 | REV 23 | REV 24 | REV 25 | REV 26
// Columnas: 1=Mes, 2=OCC23, 3=OCC24, 4=OCC25, 5=OCC26, 6=ADR23, 7=ADR24, 8=ADR25, 9=ADR26, 10=REV23, 11=REV24, 12=REV25, 13=REV26

const sourceData = [];
for (let r = 13; r <= 24; r++) {
  const row = dash.getRow(r);
  const mes = String(row.getCell(1).value ?? "").trim();
  if (!mes) continue;
  sourceData.push({
    mes,
    occ: [
      row.getCell(2).value,  // 2023
      row.getCell(3).value,  // 2024
      row.getCell(4).value,  // 2025
      row.getCell(5).value,  // 2026
    ],
    adr: [
      row.getCell(6).value,
      row.getCell(7).value,
      row.getCell(8).value,
      row.getCell(9).value,
    ],
    rev: [
      row.getCell(10).value,
      row.getCell(11).value,
      row.getCell(12).value,
      row.getCell(13).value,
    ],
  });
}

console.log(JSON.stringify(sourceData, null, 2));
