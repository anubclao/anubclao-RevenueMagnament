/**
 * db.ts — Pool MySQL con mysql2/promise.
 *
 * - Singleton global: en dev Next.js hace hot-reload y queremos reusar el pool.
 * - Decimal como STRING: el frontend lo convierte con Number() cuando lo necesita.
 * - Pool pequeño: 5 conexiones bastan para un dashboard de 1 hotel.
 * - Charset utf8mb4: NO latin1 (los tildes de "Teléfono" se rompen).
 */
import mysql from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: mysql.Pool | undefined;
}

function buildPool(): mysql.Pool {
  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? "root";
  const password = process.env.DB_PASS ?? "";
  const database = process.env.DB_NAME ?? "bora_bora_rm";

  return mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    charset: "utf8mb4",
    // Decimal strings — preserva precisión, el frontend Number() al renderizar
    decimalNumbers: false,
    // dates como string ISO, no objetos Date
    dateStrings: true,
    // Flag clave para Hostinger: reciclan conexiones, pre-ping las revive
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
  });
}

export const pool: mysql.Pool = global.__mysqlPool ?? buildPool();

if (process.env.NODE_ENV !== "production") {
  global.__mysqlPool = pool;
}

/** Helper: ejecuta una query parametrizada y retorna filas como objetos tipados. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(sql, params);
  return rows as T[];
}

/** Helper: ejecuta una query que retorna UNA fila o null. */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Health check rápido: SELECT 1. */
export async function ping(): Promise<boolean> {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.query("SELECT 1");
      return true;
    } finally {
      conn.release();
    }
  } catch {
    return false;
  }
}
