/**
 * excel.ts — Parser XLSX con exceljs (port del excel_processor.py).
 *
 * Procesa las 3 hojas que SÍ se cargan del Excel:
 *   - DB_PU_WEEK  → pickup_weekly
 *   - STLY        → stly_sales
 *   - "Venta por canal" → channel_sales_month
 *
 * "Predicciones" y "Recomendaciones" se IGNORAN (derivadas / manual).
 * "Total Alojamiento" rows se descartan (subtotal, no dato real de canal).
 */
import ExcelJS from "exceljs";

const MESES_VALIDOS = new Set([
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]);

interface ParsedExcel {
  pickup: Array<Record<string, unknown>>;
  stly: Array<Record<string, unknown>>;
  channelSales: Array<Record<string, unknown>>;
  sheetsProcessed: string[];
  totalRows: { pickup: number; stly: number; channelSales: number };
  skipped: { pickup: number; stly: number; channelSales: number; totalAlojamiento: number };
}

export async function parseExcelFile(buffer: ArrayBuffer | Uint8Array): Promise<ParsedExcel> {
  const wb = new ExcelJS.Workbook();
  // exceljs acepta Buffer en Node
  await wb.xlsx.load(buffer as ArrayBuffer);

  const out: ParsedExcel = {
    pickup: [],
    stly: [],
    channelSales: [],
    sheetsProcessed: [],
    totalRows: { pickup: 0, stly: 0, channelSales: 0 },
    skipped: { pickup: 0, stly: 0, channelSales: 0, totalAlojamiento: 0 },
  };

  // --- DB_PU_WEEK ---
  const pickupSheet = wb.getWorksheet("DB_PU_WEEK");
  if (pickupSheet) {
    out.sheetsProcessed.push("DB_PU_WEEK");
    const rows = parsePickupSheet(pickupSheet);
    out.pickup = rows.data;
    out.totalRows.pickup = rows.data.length;
    out.skipped.pickup = rows.skipped;
  }

  // --- STLY ---
  const stlySheet = wb.getWorksheet("STLY");
  if (stlySheet) {
    out.sheetsProcessed.push("STLY");
    const rows = parseStlySheet(stlySheet);
    out.stly = rows.data;
    out.totalRows.stly = rows.data.length;
    out.skipped.stly = rows.skipped;
  }

  // --- Venta por canal ---
  const channelSheet = wb.getWorksheet("Venta por canal");
  if (channelSheet) {
    out.sheetsProcessed.push("Venta por canal");
    const rows = parseChannelSalesSheet(channelSheet);
    out.channelSales = rows.data;
    out.totalRows.channelSales = rows.data.length;
    out.skipped.channelSales = rows.skipped;
    out.skipped.totalAlojamiento = rows.totalAlojamiento;
  }

  return out;
}

// -----------------------------------------------------------------------------
// DB_PU_WEEK — header en fila 2 (fila 1 vacía)
// Columnas del Excel:
//   Mes | Año | Fecha Semana | OCC Base (%) | RN Base | Ingresos 2023 |
//   ADR Base ($) | OCC Pickup (pp) | RN Pickup | ADR Pickup ($) | Revenue Pickup ($)
// -----------------------------------------------------------------------------
function parsePickupSheet(sheet: ExcelJS.Worksheet): { data: Array<Record<string, unknown>>; skipped: number } {
  const data: Array<Record<string, unknown>> = [];
  let skipped = 0;

  // Header — se detecta automáticamente (puede estar en fila 1 o 2 según el archivo)
  const headerRow = findHeaderRow(sheet, ["mes", "año", "fecha_reporte", "fechareporte"]);
  const header = getRow(sheet, headerRow);
  const colMap = mapColumns(header, [
    "mes", "mes_x",                          // Mes
    "año", "anio",                            // Año
    "fecha_semana", "fecha_reporte", "fecha", // Fecha Semana / Fecha Reporte
    "occ_base_pct", "occ_base",               // OCC Base (%)
    "rn_base",                                // RN Base
    "ingresos", "ingresos 2023", "rev_base",   // Ingresos (puede tener año en el header)
    "adr_base", "adr_base ($)",               // ADR Base ($)
    "occ_pickup_pp", "occ_pickup",            // OCC Pickup (pp)
    "rn_pickup",                              // RN Pickup
    "adr_pickup", "adr_pickup ($)",           // ADR Pickup ($)
    "revenue_pickup", "revenue_pickup ($)",   // Revenue Pickup ($)
  ]);

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = getRow(sheet, r);
    if (!row || row.length === 0) continue;

    const mes = String(row[colMap.mes] ?? "").trim();
    if (!mes || !MESES_VALIDOS.has(mes.split(" ")[0])) {
      skipped++;
      continue;
    }

    const anio = toInt(row[colMap.anio]) ?? toInt(row[colMap["año"]]) ?? 0;
    if (anio < 2020 || anio > 2100) {
      skipped++;
      continue;
    }

    const fechaRaw = row[colMap.fecha_reporte] ?? row[colMap.fecha_semana];
    const fecha = toDate(fechaRaw);
    if (!fecha) {
      skipped++;
      continue;
    }

    data.push({
      mes: mes.split(" ")[0],
      anio,
      fecha_reporte: fecha,
      occ_base_pct: toDecimal(row[colMap.occ_base_pct]) ?? 0,
      rn_base: toInt(row[colMap.rn_base]) ?? 0,
      ingresos: toDecimal(row[colMap.ingresos]) ?? 0,
      adr_base: toDecimal(row[colMap.adr_base]) ?? 0,
      occ_pickup_pp: toDecimal(row[colMap.occ_pickup_pp]) ?? 0,
      rn_pickup: toInt(row[colMap.rn_pickup]) ?? 0,
      adr_pickup: toDecimal(row[colMap.adr_pickup]) ?? 0,
      revenue_pickup: toDecimal(row[colMap.revenue_pickup]) ?? 0,
    });
  }
  return { data, skipped };
}

// -----------------------------------------------------------------------------
// STLY — header en fila 1 (semana, fecha, mes, anio_mes, canal, rn, adr, rev)
// -----------------------------------------------------------------------------
function parseStlySheet(sheet: ExcelJS.Worksheet): { data: Array<Record<string, unknown>>; skipped: number } {
  const data: Array<Record<string, unknown>> = [];
  let skipped = 0;

  const headerRow = findHeaderRow(sheet, ["semana_num", "semanamum", "fecha_semana", "mes"]);
  const header = getRow(sheet, headerRow);
  const colMap = mapColumns(header, [
    "semana_num", "semana", "semanamum", "fecha_semana", "fecha", "fechamemana", "mes", "anio_mes", "año_mes", "añomes",
    "channel", "canal", "channel_id", "rn", "adr", "rev", "revenue",
  ]);

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = getRow(sheet, r);
    if (!row || row.length === 0) continue;

    const mes = String(row[colMap.mes] ?? "").trim();
    if (!mes) {
      skipped++;
      continue;
    }

    // Fila "Total Alojamiento" — DESCARTAR (es subtotal, no dato real de canal)
    const canalCell = String(row[colMap.canal] ?? "").trim();
    if (canalCell.toLowerCase().includes("total alojamiento")) {
      skipped++;
      continue;
    }

    const semanaNum = toInt(row[colMap.semana_num]) ?? toInt(row[colMap.semana]) ?? 0;
    if (semanaNum < 1 || semanaNum > 200) {
      skipped++;
      continue;
    }

    const fechaRaw = row[colMap.fecha_semana] ?? row[colMap.fecha];
    const fecha = toDate(fechaRaw);
    if (!fecha) {
      skipped++;
      continue;
    }

    const anioMes = toInt(row[colMap.anio_mes]) ?? toInt(row[colMap["año_mes"]]);
    if (!anioMes || anioMes < 2020) {
      skipped++;
      continue;
    }

    // channel_id se resolverá por nombre en el processor principal
    const channelId = toInt(row[colMap.channel_id]) ?? null;

    data.push({
      semana_num: semanaNum,
      fecha_semana: fecha,
      mes: mes,
      anio_mes: anioMes,
      canal: canalCell, // incluir nombre del canal para resolver channel_id en el route
      channel_id: channelId,
      rn: toInt(row[colMap.rn]) ?? 0,
      adr: toDecimal(row[colMap.adr]) ?? 0,
      rev: toDecimal(row[colMap.rev]) ?? toDecimal(row[colMap.revenue]) ?? 0,
    });
  }
  return { data, skipped };
}

// -----------------------------------------------------------------------------
// Venta por canal — header en fila 4
// -----------------------------------------------------------------------------
function parseChannelSalesSheet(sheet: ExcelJS.Worksheet): {
  data: Array<Record<string, unknown>>;
  skipped: number;
  totalAlojamiento: number;
} {
  const data: Array<Record<string, unknown>> = [];
  let skipped = 0;
  let totalAlojamiento = 0;

  // Header — se detecta automáticamente (puede estar en fila 1, 2, 3 o 4)
  // El header tiene siempre: Mes, Canal, RN, ADR, Revenue (en algún orden)
  const headerRow = findHeaderRow(sheet, ["mes", "canal", "rn", "adr", "revenue"]);
  // Si el header está en fila 1 (sin filas vacías antes), hay un caso especial:
  // el header del FINAL tiene Mes en col 0, Canal en col 2, RN en col 3, ADR en col 4, Revenue en col 5
  // (sin años a la izquierda, sin agrupar por mes — años vienen dentro de las filas de datos).
  // Para el origen_check, header está en fila 4, y se agrupa por mes/año en filas iniciales.
  // Vamos a hacer un parse genérico: leer TODAS las filas, buscar meses/canales según heurística.
  const header = getRow(sheet, headerRow);
  const colMap = mapColumns(header, [
    "mes", "mes_x",
    "anio", "año",
    "canal", "channel",
    "rn", "rn_total",
    "adr", "adr_promedio", "adrpromedio",
    "revenue", "rev", "revenue_total",
  ]);

  // Detectar columnas clave a partir del header
  const mesCol = colMap.mes >= 0 ? colMap.mes : colMap.mes_x;
  const anioCol = colMap.anio >= 0 ? colMap.anio : colMap["año"];
  const canalCol = colMap.canal >= 0 ? colMap.canal : colMap.channel;
  const rnCol = colMap.rn >= 0 ? colMap.rn : colMap.rn_total;
  const adrCol = colMap.adr >= 0 ? colMap.adr : colMap.adr_promedio;
  const revCol = colMap.revenue_total >= 0
    ? colMap.revenue_total
    : (colMap.revenue >= 0 ? colMap.revenue : colMap.rev);

  let currentMes = "";
  let currentAnio = 0;

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = getRow(sheet, r);
    if (!row || row.length === 0) continue;

    // Detectar mes en la celda del mes (si está mapeado)
    if (mesCol >= 0) {
      const mesCell = String(row[mesCol] ?? "").trim();
      if (mesCell && MESES_VALIDOS.has(mesCell.split(" ")[0])) {
        currentMes = mesCell.split(" ")[0];
        if (anioCol >= 0) {
          const anioCell = toInt(row[anioCol]);
          if (anioCell && anioCell > 2020) currentAnio = anioCell;
        }
        // Si la fila SOLO contiene mes/año (estilo "Enero 2026" en col 0 + col 1), skip
        // pero solo si no hay también un canal en esta fila
        if (canalCol < 0 || !row[canalCol]) continue;
      }
    }

    // Fila vacía entre meses
    if (row.every((c) => c == null || c === "")) continue;

    // Fila "Total Alojamiento" — DESCARTAR completamente
    const canalRaw = canalCol >= 0
      ? String(row[canalCol] ?? "").trim()
      : String(row[1] ?? row[2] ?? "").trim();
    if (canalRaw.toLowerCase().includes("total alojamiento")) {
      totalAlojamiento++;
      continue;
    }

    if (!canalRaw || !currentMes || !currentAnio) {
      skipped++;
      continue;
    }

    data.push({
      anio: currentAnio,
      mes: currentMes,
      channel_name: canalRaw,
      rn_total: rnCol >= 0 ? (toInt(row[rnCol]) ?? 0) : 0,
      adr_promedio: adrCol >= 0 ? (toDecimal(row[adrCol]) ?? 0) : 0,
      revenue_total: revCol >= 0 ? (toDecimal(row[revCol]) ?? 0) : 0,
    });
  }
  return { data, skipped, totalAlojamiento };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function getRow(sheet: ExcelJS.Worksheet, n: number): unknown[] {
  const row = sheet.getRow(n);
  const out: unknown[] = [];
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    out[colNumber - 1] = cellValue(cell);
  });
  return out;
}

function cellValue(cell: ExcelJS.Cell): unknown {
  if (cell.value === null || cell.value === undefined) return null;
  if (typeof cell.value === "object" && "result" in (cell.value as object)) {
    return (cell.value as { result: unknown }).result;
  }
  if (typeof cell.value === "object" && "text" in (cell.value as object)) {
    return (cell.value as { text: unknown }).text;
  }
  if (cell.value instanceof Date) return cell.value;
  return cell.value;
}

function mapColumns(header: unknown[], candidates: string[]): Record<string, number> {
  // Normaliza quitando todo lo que no sea alfanumérico para tolerar:
  //   "OCC Base (%)"     → "occbase"
  //   "Ingresos 2023"    → "ingresos2023"
  //   "ADR Pickup ($)"    → "adrpickup"
  //   "fecha_semana"      → "fechasemana"
  //   "Año_Mes"           → "añomes" (preserva la ñ como alfanumérico)
  //   "Semana_Num"        → "semanamum"
  //   "Ingresos"          → "ingresos"  (también matchea "Ingresos 2023" → "ingresos2023" sin matchear ingresos)
  const norm = (s: unknown) =>
    String(s ?? "").toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, "");
  const map: Record<string, number> = {};
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

/**
 * Encuentra la fila de header buscando una que contenga al menos uno de los
 * "anchor" tokens (case-insensitive, normalizado). Útil cuando el Excel
 * tiene filas vacías o titulos antes del header real.
 *
 * Ejemplo: si el header es `["Mes","Año","Fecha Reporte"]` y anchors son
 * `["mes","año"]`, retorna la fila 1.
 */
function findHeaderRow(
  sheet: ExcelJS.Worksheet,
  anchors: string[],
  maxRows = 8
): number {
  const norm = (s: unknown) =>
    String(s ?? "").toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, "");
  const targets = anchors.map(norm).filter(Boolean);
  for (let r = 1; r <= Math.min(maxRows, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    const found: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      found.push(norm(cell.value));
    });
    if (targets.some((t) => found.includes(t))) {
      return r;
    }
  }
  return 1; // fallback: usar fila 1
}

function toInt(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toDecimal(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  if (typeof x === "number") return x;
  const s = String(x).replace(/[\s,$]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toDate(x: unknown): string | null {
  if (x === null || x === undefined) return null;
  if (x instanceof Date) {
    return x.toISOString().slice(0, 10);
  }
  if (typeof x === "number") {
    // Excel serial date
    const d = new Date((x - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(x).trim();
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
