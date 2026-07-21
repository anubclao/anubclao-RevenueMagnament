<?php
$pdo = new PDO('mysql:host=127.0.0.1;port=3306;dbname=bora_bora_rm;charset=utf8mb4', 'root', 'Anubclao2026');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
echo "Connected to bora_bora_rm\n";
echo "Loading seed_data.sql...\n";
$sql = file_get_contents(__DIR__ . '/../../docs/seed_data.sql');
// Strip UTF-8 BOM si está presente
if (substr($sql, 0, 3) === "\xEF\xBB\xBF") {
  $sql = substr($sql, 3);
}
$pdo->exec($sql);
echo "Seed loaded OK\n";
foreach (['channels','pickup_weekly','stly_sales','channel_sales_month','ingest_log'] as $t) {
  $row = $pdo->query('SELECT COUNT(*) AS c FROM ' . $t)->fetch();
  echo sprintf("  %-22s %s filas\n", $t, number_format($row['c']));
}
