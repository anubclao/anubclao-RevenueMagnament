// Inspección rápida - solo header + muestra + conteo
const ExcelJS = require("../frontend/node_modules/exceljs");

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("docs/BORA_BORA_origen_check.xlsx", { cellDates: false });

  for (const sheetName of ["DB_PU_WEEK", "DB_SEG"]) {
    const sheet = wb.getWorksheet(sheetName);
    console.log(`\n========== HOJA: ${sheetName} ==========`);
    console.log(`Row count: ${sheet.rowCount}, actualRowCount: ${sheet.actualRowCount}`);

    // Detectar header row
    for (let r = 1; r <= 5; r++) {
      const row = sheet.getRow(r);
      let nonEmpty = 0;
      for (let c = 1; c <= 12; c++) {
        if (row.getCell(c).value !== null && row.getCell(c).value !== "") nonEmpty++;
      }
      if (nonEmpty >= 5) {
        console.log(`Header row: ${r}`);
        const headers = [];
        for (let c = 1; c <= 12; c++) {
          const v = row.getCell(c).value;
          if (v !== null) headers.push(`${c}:${v}`);
        }
        console.log(`Headers: ${headers.join(" | ")}`);
        break;
      }
    }
  }
  process.exit(0);
})();
