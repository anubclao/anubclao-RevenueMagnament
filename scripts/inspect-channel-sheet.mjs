// scripts/inspect-channel-sheet.mjs
// Inspección profunda de la hoja "Venta por canal"
import ExcelJS from "exceljs";

const FILE = "docs/BORA_BORA_Informe_Ejecutivo FINAL.xlsx";
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);
const vc = wb.getWorksheet("Venta por canal");

console.log(`Hoja "Venta por canal" — ${vc.rowCount} filas × ${vc.columnCount} cols\n`);

// Imprimir las primeras 15 filas COMPLETAS
for (let r = 1; r <= Math.min(15, vc.rowCount); r++) {
  const row = vc.getRow(r);
  const cells = [];
  for (let c = 1; c <= vc.columnCount; c++) {
    const v = row.getCell(c).value;
    cells.push(v === null || v === undefined ? "" : String(v).slice(0, 30));
  }
  console.log(`R${String(r).padStart(2)}: [${cells.join(" | ")}]`);
}

console.log("\n--- Últimas 10 filas ---");
for (let r = Math.max(1, vc.rowCount - 10); r <= vc.rowCount; r++) {
  const row = vc.getRow(r);
  const cells = [];
  for (let c = 1; c <= vc.columnCount; c++) {
    const v = row.getCell(c).value;
    cells.push(v === null || v === undefined ? "" : String(v).slice(0, 30));
  }
  console.log(`R${String(r).padStart(2)}: [${cells.join(" | ")}]`);
}
