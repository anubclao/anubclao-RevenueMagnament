// Inspección exhaustiva del Excel fuente
const ExcelJS = require("../frontend/node_modules/exceljs");

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("docs/BORA_BORA_origen_check.xlsx");

  console.log("=== HOJAS ===");
  console.log(wb.worksheets.map((s) => s.name).join("\n"));
  console.log("");

  for (const sheet of wb.worksheets) {
    console.log(`\n========== HOJA: ${sheet.name} ==========`);
    console.log(`Rows: ${sheet.rowCount} | Columns: ${sheet.columnCount}`);
    console.log(`AutoFilter: ${sheet.autoFilter ? JSON.stringify(sheet.autoFilter) : "NINGUNO"}`);
    console.log(`State: ${sheet.state}`);

    // Primera fila (headers)
    if (sheet.rowCount > 0) {
      const headerRow = sheet.getRow(1);
      const headers = [];
      headerRow.eachCell((cell, colNumber) => {
        headers.push(`${colNumber}: ${cell.value}`);
      });
      console.log(`Headers: ${headers.slice(0, 15).join(" | ")}`);
    }

    // Muestra: primeras 3 filas
    console.log("\n--- Primeras 3 filas ---");
    for (let r = 1; r <= Math.min(3, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      const vals = [];
      for (let c = 1; c <= Math.min(8, sheet.columnCount); c++) {
        const cell = row.getCell(c);
        let v = cell.value;
        if (v && typeof v === "object" && v.text) v = v.text;
        if (v && typeof v === "object" && v.result) v = v.result;
        vals.push(v);
      }
      console.log(`  R${r}: ${JSON.stringify(vals)}`);
    }

    // Si es STLY o Venta por canal, contar "Total Alojamiento"
    const colCanal = sheet.getRow(1).values.findIndex((v) => v && typeof v === "string" && /canal/i.test(String(v)));
    if (colCanal > 0) {
      let totalRows = 0;
      let totalAlojamiento = 0;
      let otherCanales = new Set();
      const otherRows = [];
      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const canalVal = row.getCell(colCanal).value;
        if (canalVal === null || canalVal === undefined) continue;
        totalRows++;
        const canalStr = String(canalVal).trim();
        if (/total\s*alojamiento/i.test(canalStr)) {
          totalAlojamiento++;
        } else {
          otherCanales.add(canalStr);
          if (otherRows.length < 3) {
            const vals = [];
            for (let c = 1; c <= Math.min(8, sheet.columnCount); c++) {
              let v = row.getCell(c).value;
              if (v && typeof v === "object" && v.text) v = v.text;
              if (v && typeof v === "object" && v.result) v = v.result;
              vals.push(v);
            }
            otherRows.push(`R${r}: ${JSON.stringify(vals)}`);
          }
        }
      }
      console.log(`\n--- Análisis columna Canal (col ${colCanal}) ---`);
      console.log(`Filas con datos: ${totalRows}`);
      console.log(`"Total Alojamiento": ${totalAlojamiento} (${((totalAlojamiento / totalRows) * 100).toFixed(1)}%)`);
      console.log(`Otros canales distintos: ${otherCanales.size}`);
      console.log(`Primeros 20 canales distintos: ${[...otherCanales].slice(0, 20).join(", ")}`);
      console.log("\n--- 3 filas de muestra NO-Total-Alojamiento ---");
      otherRows.forEach((r) => console.log(`  ${r}`));
    }
  }
})();
