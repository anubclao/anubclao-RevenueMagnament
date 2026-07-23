-- ===========================================================================
-- BORA BORA — Seed de TENDENCIA MENSUAL (hoja Dashboard del Excel FINAL)
-- GENERADO AUTOMÁTICAMENTE por scripts/regenerate-dashboard-seed.mjs
-- 48 registros = 12 meses × 4 años (2023-2026)
-- Carga OCC + ADR + Revenue históricos.
-- NO contiene CREATE DATABASE ni USE — DB-agnóstico (seleccionar DB en phpMyAdmin).
-- ===========================================================================

-- Idempotencia: si ya hay datos, los reemplaza
DELETE FROM dashboard_monthly WHERE anio IN (2023, 2024, 2025, 2026);

INSERT INTO dashboard_monthly (anio, mes, occ_pct, adr, rev, source_file) VALUES
-- ==================== 2023 ====================
(2023, 'Enero', 73.66, 1542948, 211383860, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Febrero', 67.26, 1466598, 165725522, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Marzo', 63.44, 1469849, 173442196, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Abril', 55.00, 1488891, 147400182, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Mayo', 40.86, 1469460, 111678937, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Junio', 51.67, 1471494, 136848904, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Julio', 52.69, 1410889, 138267080, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Agosto', 83.33, 1471053, 228013175, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Septiembre', 41.67, 1456087, 109206527, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Octubre', 42.47, 1406609, 111122113, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Noviembre', 47.22, 1450473, 123290163, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2023, 'Diciembre', 67.74, 1427240, 179832301, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx');

-- ==================== 2024 ====================
(2024, 'Enero', 82.26, 1445768, 217561234, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Febrero', 82.76, 1323528, 189740390, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Marzo', 79.03, 1387086, 202515877, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Abril', 71.67, 1221500, 156965444, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Mayo', 74.19, 1212040, 165287113, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Junio', 73.89, 1093000, 142946443, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Julio', 60.75, 1197202, 131717318, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Agosto', 79.57, 1371957, 198205923, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Septiembre', 72.22, 1109597, 140715786, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Octubre', 69.35, 1054170, 132414436, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Noviembre', 81.11, 1138686, 162600805, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2024, 'Diciembre', 87.10, 1415964, 225311152, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),

-- ==================== 2025 ====================
(2025, 'Enero', 93.01, 1414716, 244745943, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Febrero', 86.31, 1293177, 187510670, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Marzo', 84.95, 1274350, 201347378, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Abril', 76.67, 1300386, 179453217, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Mayo', 69.35, 1160991, 149767895, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Junio', 72.78, 1250722, 163844549, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Julio', 84.41, 1153859, 181155883, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Agosto', 70.43, 1486763, 194765914, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Septiembre', 67.78, 1169863, 142723318, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Octubre', 61.00, 1147728, 129693317, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Noviembre', 84.44, 1227371, 186560419, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2025, 'Diciembre', 65.59, 1341711, 175764190, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),

-- ==================== 2026 ====================
(2026, 'Enero', 87.10, 1523855, 246864586, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Febrero', 85.12, 1357618, 194139311, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Marzo', 86.02, 1229077, 196652315, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Abril', 67.78, 1300905, 158710411, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Mayo', 65.50, 1234134, 150564288, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Junio', 59.44, 1208256, 129283380, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Julio', 56.45, 1274258, 133797114, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Agosto', 53.76, 1327357, 132735709, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Septiembre', 28.89, 1220583, 63470292, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Octubre', 9.14, 1293299, 21986077, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Noviembre', 10.56, 1144367, 21742981, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),
(2026, 'Diciembre', 17.74, 1318755, 43518918, 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx'),

-- Verificación
SELECT anio, COUNT(*) AS meses, AVG(occ_pct) AS occ_media, SUM(rev) AS rev_total
FROM dashboard_monthly
GROUP BY anio
ORDER BY anio;
