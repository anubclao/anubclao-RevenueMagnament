// scripts/inspect-pickup.mjs — ver estructura real del sheet DB_PU_WEEK
import ExcelJS from "exceljs";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("docs/BORA_BORA_Informe_Ejecutivo FINAL.xlsx");
const sh = wb.getWorksheet("DB_PU_WEEK");
console.log(`DB_PU_WEEK: ${sh.rowCount} filas × ${sh.columnCount} cols`);

for (let r = 1; r <= 8; r++) {
  const row = sh.getRow(r);
  const cells = [];
  for (let c = 1; c <= sh.columnCount; c++) {
    const v = row.getCell(c).value;
    cells.push(v === null || v === undefined ? "" : String(v).slice(0, 22));
  }
  console.log(`R${String(r).padStart(2)}: [${cells.join(" | ")}]`);
}

console.log("\n--- Enero 2026 detalle (filas 3-30) ---");
for (let r = 3; r <= 30; r++) {
  const row = sh.getRow(r);
  const mes = String(row.getCell(1).value ?? "").trim();
  const anio = row.getCell(2).value;
  const fecha = row.getCell(3).value;
  console.log(`R${String(r).padStart(2)}: mes="${mes}" anio=${anio} fecha=${fecha instanceof Date ? fecha.toISOString().slice(0,10) : fecha}`);
}
