// Inspección detallada de DB_PU_WEEK y DB_SEG
const ExcelJS = require("../frontend/node_modules/exceljs");

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("docs/BORA_BORA_origen_check.xlsx");

  for (const sheetName of ["DB_PU_WEEK", "DB_SEG"]) {
    const sheet = wb.getWorksheet(sheetName);
    console.log(`\n========== HOJA: ${sheetName} ==========`);
    console.log(`Rows: ${sheet.rowCount} | Columns: ${sheet.columnCount}`);

    // Detectar header row (la fila con texto no nulo)
    let headerRowNum = 1;
    for (let r = 1; r <= Math.min(5, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      let nonEmpty = 0;
      for (let c = 1; c <= sheet.columnCount; c++) {
        if (row.getCell(c).value !== null) nonEmpty++;
      }
      if (nonEmpty >= 3) {
        headerRowNum = r;
        break;
      }
    }
    console.log(`Header row: ${headerRowNum}`);

    // Headers
    const headerRow = sheet.getRow(headerRowNum);
    const headers = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      headers.push(`${c}: ${headerRow.getCell(c).value}`);
    }
    console.log(`Headers: ${headers.join(" | ")}`);

    // Contar filas con data real (no vacías)
    let realRows = 0;
    const yearCol = headers.findIndex((h) => /a[ñn]o/i.test(h));
    console.log(`Columna Año detectada en idx: ${yearCol}`);

    const byYear = {};
    const sampleRows = [];
    for (let r = headerRowNum + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      let nonEmpty = 0;
      for (let c = 1; c <= sheet.columnCount; c++) {
        if (row.getCell(c).value !== null && row.getCell(c).value !== "") nonEmpty++;
      }
      if (nonEmpty >= 3) {
        realRows++;
        if (yearCol > 0) {
          const anio = row.getCell(yearCol).value;
          byYear[anio] = (byYear[anio] || 0) + 1;
        }
        if (sampleRows.length < 3) {
          const vals = [];
          for (let c = 1; c <= Math.min(8, sheet.columnCount); c++) {
            let v = row.getCell(c).value;
            if (v && typeof v === "object" && v.text) v = v.text;
            if (v && typeof v === "object" && v.result) v = v.result;
            if (v instanceof Date) v = v.toISOString().slice(0, 10);
            vals.push(v);
          }
          sampleRows.push(`R${r}: ${JSON.stringify(vals)}`);
        }
      }
    }
    console.log(`Filas con datos reales: ${realRows}`);
    console.log(`Por año: ${JSON.stringify(byYear)}`);
    console.log(`Muestra:`);
    sampleRows.forEach((r) => console.log(`  ${r}`));

    // Para DB_SEG: contar "Total Alojamiento" vs canales reales
    if (sheetName === "DB_SEG") {
      const canalCol = 3; // por header
      let totalAlojamiento = 0;
      let canalesDistintos = new Set();
      for (let r = headerRowNum + 1; r <= sheet.rowCount; r++) {
        const v = sheet.getRow(r).getCell(canalCol).value;
        if (v) {
          const s = String(v).trim();
          if (/total\s*alojamiento/i.test(s)) totalAlojamiento++;
          else canalesDistintos.add(s);
        }
      }
      console.log(`\nTotal Alojamiento: ${totalAlojamiento}`);
      console.log(`Canales distintos: ${canalesDistintos.size}`);
      console.log(`Canales: ${[...canalesDistintos].join(", ")}`);
    }
  }
})();
