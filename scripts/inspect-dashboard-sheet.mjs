// scripts/inspect-dashboard-sheet.mjs
import ExcelJS from "exceljs";

const FILE = "docs/BORA_BORA_Informe_Ejecutivo FINAL.xlsx";
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);
const dash = wb.getWorksheet("Dashboard");
console.log(`Hoja "Dashboard" — ${dash.rowCount} filas × ${dash.columnCount} cols\n`);

for (let r = 1; r <= Math.min(20, dash.rowCount); r++) {
  const row = dash.getRow(r);
  const cells = [];
  for (let c = 1; c <= dash.columnCount; c++) {
    const v = row.getCell(c).value;
    cells.push(v === null || v === undefined ? "" : String(v).slice(0, 25));
  }
  console.log(`R${String(r).padStart(2)}: [${cells.join(" | ")}]`);
}
