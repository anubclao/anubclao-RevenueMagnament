// scripts/inspect-duplicates.mjs
// Cuenta duplicados por (mes, anio, fecha_reporte) en el Excel fuente
import ExcelJS from "exceljs";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("docs/BORA_BORA_Informe_Ejecutivo FINAL.xlsx");

function checkDupes(sheetName, keyCols) {
  const sh = wb.getWorksheet(sheetName);
  if (!sh) return;
  const counts = new Map();
  for (let r = 2; r <= sh.rowCount; r++) {
    const row = sh.getRow(r);
    const key = keyCols.map((c) => String(row.getCell(c).value ?? "").trim()).join("|");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let total = 0, unique = 0, dupes = 0;
  for (const [k, n] of counts) {
    total += n;
    if (n === 1) unique++;
    else { dupes++; console.log(`DUPE [${sheetName}] key=${k.slice(0, 80)} → ${n} rows`); }
  }
  console.log(`${sheetName}: total=${total} unique=${unique} keys with dupes=${dupes}`);
}

console.log("=== DB_PU_WEEK (cols 1=mes, 2=anio, 3=fecha) ===");
checkDupes("DB_PU_WEEK", [1, 2, 3]);

console.log("\n=== STLY (cols 1=semana, 2=fecha, 3=mes, 4=anio_mes, 5=canal) ===");
checkDupes("STLY", [1, 2, 3, 4, 5]);
