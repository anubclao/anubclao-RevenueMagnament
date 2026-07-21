<?php
$count = 0;
foreach (['docs/init.sql', 'docs/seed_data.sql'] as $rel) {
  $path = __DIR__ . '/../../' . $rel;
  $content = file_get_contents($path);
  $before = strlen($content);
  $content = str_replace("\xEF\xBB\xBF", '', $content, $c);
  if ($c > 0) {
    file_put_contents($path, $content);
    echo "$rel: stripped $c BOM(s)\n";
    $count += $c;
  }
}
echo "Total BOMs stripped: $count\n";
