-- ===========================================================================
-- BORA BORA — Seed de TENDENCIA MENSUAL (hoja Dashboard del Excel FINAL)
-- 12 meses × 4 años = 48 registros
-- Carga OCC + ADR + Revenue históricos para 2023-2026
-- ===========================================================================

USE bora_bora_rm;

-- Idempotencia: si ya hay datos, no duplicar
DELETE FROM dashboard_monthly WHERE anio IN (2023, 2024, 2025, 2026);

INSERT INTO dashboard_monthly (anio, mes, occ_pct, adr, rev, source_file) VALUES
-- ==================== 2023 ====================
(2023, 'Enero',       73.7, 1542948, 211383860, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Febrero',     67.3, 1466598, 165725522, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Marzo',       63.4, 1469849, 173442196, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Abril',       55.0, 1488891, 147400182, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Mayo',        40.9, 1469460, 111678937, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Junio',       51.7, 1471494, 136848904, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Julio',       52.7, 1410889, 138267080, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Agosto',      83.3, 1471053, 228013175, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Septiembre',  41.7, 1456087, 109206527, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Octubre',     42.5, 1406609, 111122113, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Noviembre',   47.2, 1450473, 123290163, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Diciembre',   67.7, 1427240, 179832301, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),

-- ==================== 2024 ====================
(2024, 'Enero',       82.3, 1445768, 217561234, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Febrero',     82.8, 1323528, 189740390, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Marzo',       79.0, 1387086, 202515877, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Abril',       71.7, 1221500, 156965444, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Mayo',        74.2, 1212040, 165287113, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Junio',       73.9, 1093000, 142946443, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Julio',       60.8, 1197202, 131717518, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Agosto',      79.6, 1371957, 198205923, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Septiembre',  72.2, 1109597, 140715786, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Octubre',     69.4, 1054170, 132414436, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Noviembre',   81.1, 1138686, 162600805, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Diciembre',   87.1, 1415964, 225311152, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),

-- ==================== 2025 ====================
(2025, 'Enero',       93.0, 1414716, 244745943, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Febrero',     86.3, 1293177, 187510670, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Marzo',       85.0, 1274350, 201347378, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Abril',       76.7, 1300905, 179453217, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Mayo',        69.4, 1160991, 149767895, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Junio',       72.8, 1250722, 163844549, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Julio',       84.4, 1274258, 181155883, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Agosto',      70.4, 1327325, 194755914, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Septiembre',  67.8, 1220583, 142723318, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Octubre',     61.0, 1293299, 129693317, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Noviembre',   84.4, 1144367, 166560419, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Diciembre',   65.6, 1341873, 175764190, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),

-- ==================== 2026 (parcial, hasta Julio con datos reales) ====================
(2026, 'Enero',       87.1, 1523855, 246864586, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Febrero',     85.1, 1357618, 194139311, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Marzo',       86.0, 1229077, 196652315, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Abril',       67.8, 1500811, 158710411, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Mayo',        65.5, 1234134, 150564288, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Junio',       59.4, 1208256, 129283380, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Julio',       56.5, 1281636, 133797114, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Agosto',      53.8, 1486763, 132735709, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Septiembre',  28.9, 1169863,  63470292, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Octubre',      9.1, 1178728,  21986077, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Noviembre',   10.6, 1228371,  21742981, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Diciembre',   17.7, 1318755,  43518918, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx');

-- Verificación
SELECT anio, COUNT(*) AS meses, AVG(occ_pct) AS occ_media, SUM(rev) AS rev_total
FROM dashboard_monthly
GROUP BY anio
ORDER BY anio;
