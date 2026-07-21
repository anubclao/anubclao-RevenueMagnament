<?php
$pdo = new PDO('mysql:host=127.0.0.1;port=3306', 'root', 'Anubclao2026');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
echo "MySQL connected\n";
$pdo->exec('DROP DATABASE IF EXISTS bora_bora_rm');
$pdo->exec('CREATE DATABASE bora_bora_rm DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci');
echo "DB 'bora_bora_rm' created with utf8mb4\n";
