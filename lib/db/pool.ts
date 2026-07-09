import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as { __kimchiPgPool?: Pool };

/**
 * Server-only Postgres pool.
 * Prefer DATABASE_URL (transaction pooler :6543) so concurrent clients are not
 * capped by session-mode pool_size (EMAXCONNSESSION). DIRECT_URL is session
 * mode — keep it for migrations only.
 */
export function getPool(): Pool {
  if (globalForPg.__kimchiPgPool) {
    return globalForPg.__kimchiPgPool;
  }

  const connectionString =
    process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();

  if (!connectionString) {
    throw new Error(
      "Thiếu DATABASE_URL hoặc DIRECT_URL trong .env.local (kết nối Postgres Supabase)."
    );
  }

  // Session pooler (:5432) limits concurrent clients ≈ pool_size (often 15).
  // Prefer transaction pooler (:6543) for app traffic.
  if (/:5432\b/.test(connectionString) && !process.env.DATABASE_URL?.trim()) {
    console.warn(
      "[db] Using session-mode URL (:5432). Set DATABASE_URL to the :6543 transaction pooler to avoid EMAXCONNSESSION."
    );
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    // Keep small: free Supabase session pool_size is often 15 total.
    max: Number(process.env.PG_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  });

  pool.on("error", (err) => {
    console.error("[db] Unexpected idle client error", err);
  });

  globalForPg.__kimchiPgPool = pool;
  return pool;
}

/** Run work on one checked-out client (same backend connection). */
export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Transaction helper. Needed for set_config(..., true) so the GUC stays on
 * the same connection as the following statements (works with pgbouncer
 * transaction mode).
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    }
  });
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}
