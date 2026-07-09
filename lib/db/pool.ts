import { Pool } from "pg";

let pool: Pool | null = null;

/** Server-only Postgres pool (DIRECT_URL or DATABASE_URL). Never import from client. */
export function getPool(): Pool {
  if (pool) return pool;

  const connectionString =
    process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      "Thiếu DIRECT_URL hoặc DATABASE_URL trong .env.local (kết nối Postgres Supabase)."
    );
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  return pool;
}
