import { NextRequest, NextResponse } from "next/server";
import { query, pool } from "@/lib/db";
import { parseExcelFile } from "@/lib/excel";

export const dynamic = "force-dynamic";
// El Excel puede ser > 4 MB, subimos el límite del body parser de Next
export const maxDuration = 120; // 2 min

const SOURCE_FILE = "uploaded_excel.xlsx";

interface ChannelRow { id: number; name: string }
interface OkPacket { affectedRows: number; insertId?: number }

/** Cache de canales por nombre normalizado (lowercase + trim). Case-insensitive. */
async function getChannelMap(): Promise<Map<string, number>> {
  const rows = await query<ChannelRow>(`SELECT id, name FROM channels`);
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.name.toLowerCase().trim(), r.id);
  }
  // Aliases para typos y variantes de mayúsculas que aparecen en el Excel
  // (no los agregamos a la tabla channels porque son entradas "sucias")
  const aliases: Array<[string, number]> = [
    ["cliente corporatvio", 23], // typo en el Excel
  ];
  for (const [name, id] of aliases) {
    if (!map.has(name)) map.set(name, id);
  }
  return map;
}

/** Ejecuta INSERT/UPDATE y devuelve el OkPacket (no la lista de rows). */
async function exec(sql: string, params: unknown[] = []): Promise<OkPacket> {
  const [result] = await pool.query(sql, params);
  return result as OkPacket;
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const errors: string[] = [];

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ detail: "file is required" }, { status: 400 });
    }
    const buffer = await file.arrayBuffer();
    const sourceFile = file.name || SOURCE_FILE;

    const parsed = await parseExcelFile(buffer);
    const channelMap = await getChannelMap();

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // 1) UPSERT pickup_weekly — INSERT ... ON DUPLICATE KEY UPDATE (atómico, no snapshot issues)
    for (const row of parsed.pickup) {
      try {
        const ok = await exec(
          `INSERT INTO pickup_weekly
            (mes, anio, fecha_reporte, occ_base_pct, rn_base, ingresos, adr_base,
             occ_pickup_pp, rn_pickup, adr_pickup, revenue_pickup, source_file)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             occ_base_pct = VALUES(occ_base_pct),
             rn_base = VALUES(rn_base),
             ingresos = VALUES(ingresos),
             adr_base = VALUES(adr_base),
             occ_pickup_pp = VALUES(occ_pickup_pp),
             rn_pickup = VALUES(rn_pickup),
             adr_pickup = VALUES(adr_pickup),
             revenue_pickup = VALUES(revenue_pickup),
             source_file = VALUES(source_file),
             updated_at = NOW()`,
          [
            row.mes, row.anio, row.fecha_reporte,
            row.occ_base_pct, row.rn_base, row.ingresos, row.adr_base,
            row.occ_pickup_pp, row.rn_pickup, row.adr_pickup, row.revenue_pickup,
            sourceFile,
          ]
        );
        // affectedRows = 1 → INSERT, = 2 → UPDATE (en MySQL, UPDATE cuenta como 2)
        if (ok.affectedRows === 1) inserted++;
        else if (ok.affectedRows === 2) updated++;
        else inserted++;
      } catch (e) {
        errors.push(`pickup[${row.anio}-${row.mes}-${row.fecha_reporte}]: ${e instanceof Error ? e.message : e}`);
        skipped++;
      }
    }

    // 2) UPSERT stly_sales
    for (const row of parsed.stly) {
      try {
        const canalKey = String(row.canal ?? "").toLowerCase().trim();
        const channelId = row.channel_id ?? channelMap.get(canalKey) ?? null;
        const ok = await exec(
          `INSERT INTO stly_sales
            (semana_num, fecha_semana, mes, anio_mes, channel_id, rn, adr, rev, source_file)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             semana_num = VALUES(semana_num),
             rn = VALUES(rn),
             adr = VALUES(adr),
             rev = VALUES(rev),
             source_file = VALUES(source_file)`,
          [row.semana_num, row.fecha_semana, row.mes, row.anio_mes,
           channelId, row.rn, row.adr, row.rev, sourceFile]
        );
        if (ok.affectedRows === 1) inserted++;
        else if (ok.affectedRows === 2) updated++;
        else inserted++;
      } catch (e) {
        errors.push(`stly: ${e instanceof Error ? e.message : e}`);
        skipped++;
      }
    }

    // 3) UPSERT channel_sales_month
    for (const row of parsed.channelSales) {
      try {
        const channelKey = String(row.channel_name).toLowerCase().trim();
        const channelId = channelMap.get(channelKey);
        if (channelId == null) {
          errors.push(`channel_sales: canal desconocido "${row.channel_name}"`);
          skipped++;
          continue;
        }
        const ok = await exec(
          `INSERT INTO channel_sales_month
            (anio, mes, channel_id, rn_total, adr_promedio, revenue_total, source_file)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             rn_total = VALUES(rn_total),
             adr_promedio = VALUES(adr_promedio),
             revenue_total = VALUES(revenue_total),
             source_file = VALUES(source_file),
             updated_at = NOW()`,
          [row.anio, row.mes, channelId, row.rn_total, row.adr_promedio, row.revenue_total, sourceFile]
        );
        if (ok.affectedRows === 1) inserted++;
        else if (ok.affectedRows === 2) updated++;
        else inserted++;
      } catch (e) {
        errors.push(`channel_sales[${row.anio}-${row.mes}]: ${e instanceof Error ? e.message : e}`);
        skipped++;
      }
    }

    const totalSkipped = skipped + parsed.skipped.totalAlojamiento;
    const duration = (Date.now() - t0) / 1000;

    // Log del upload
    await query(
      `INSERT INTO ingest_log
        (source_file, sheet_name, rows_inserted, rows_updated, rows_skipped, uploaded_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [sourceFile, parsed.sheetsProcessed.join(","), inserted, updated, totalSkipped]
    );

    return NextResponse.json({
      source_file: sourceFile,
      sheets_processed: parsed.sheetsProcessed,
      total_rows_inserted: inserted,
      total_rows_updated: updated,
      total_rows_skipped: totalSkipped,
      total_alojamiento_skipped: parsed.skipped.totalAlojamiento,
      errors,
      duration_seconds: duration,
    });
  } catch (e) {
    console.error("[upload-excel POST]", e);
    return NextResponse.json(
      {
        detail: e instanceof Error ? e.message : "internal error",
        error_class: e instanceof Error ? e.constructor.name : "unknown",
      },
      { status: 500 }
    );
  }
}
