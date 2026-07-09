import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as {
  __kimchiPgPool?: Pool;
  __kimchiPgPoolLog?: boolean;
};

/** True if error is Supavisor/pgbouncer session pool exhaustion. */
export function isMaxConnSessionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    msg.includes("EMAXCONNSESSION") ||
    msg.includes("max clients reached in session mode") ||
    /max clients are limited to pool_size/i.test(msg)
  );
}

/**
 * Force Supabase transaction pooler (:6543) for app traffic.
 * Session pooler (:5432) caps concurrent clients at pool_size (~15) → EMAXCONNSESSION.
 */
function resolveAppConnectionString(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();

  let url = databaseUrl || directUrl || "";
  if (!url) {
    throw new Error(
      "Thiếu DATABASE_URL trong .env.local (transaction pooler :6543). Không dùng session :5432 cho app."
    );
  }

  // Rewrite session pooler → transaction pooler when possible
  if (/pooler\.supabase\.com:5432\b/i.test(url)) {
    url = url
      .replace(/:5432\b/, ":6543")
      .replace(/[?&]pgbouncer=true/gi, "");
    url += url.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
    if (!globalForPg.__kimchiPgPoolLog) {
      console.warn(
        "[db] Rewrote session pooler :5432 → transaction :6543 (avoid EMAXCONNSESSION)."
      );
    }
  }

  if (/pooler\.supabase\.com:5432\b/i.test(url) || /:5432\b/.test(url) && /pooler\.supabase/i.test(url)) {
    throw new Error(
      "[db] App must not use session pooler :5432. Set DATABASE_URL to port 6543 (Transaction mode)."
    );
  }

  // Ensure pgbouncer flag on 6543 (harmless for node-pg; documents intent)
  if (/:6543\b/.test(url) && !/[?&]pgbouncer=true/i.test(url)) {
    url += url.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
  }

  return url;
}

/**
 * Server-only Postgres pool.
 * Always transaction pooler when using Supabase; tiny max to protect free tier.
 */
export function getPool(): Pool {
  if (globalForPg.__kimchiPgPool) {
    return globalForPg.__kimchiPgPool;
  }

  const connectionString = resolveAppConnectionString();
  const max = Math.max(1, Number(process.env.PG_POOL_MAX ?? 1));

  if (!globalForPg.__kimchiPgPoolLog) {
    const port = connectionString.match(/:(\d+)\//)?.[1] ?? "?";
    const mode = port === "6543" ? "transaction" : port === "5432" ? "session" : "unknown";
    console.info(`[db] Postgres pool ready port=${port} mode=${mode} max=${max}`);
    globalForPg.__kimchiPgPoolLog = true;
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });

  pool.on("error", (err) => {
    console.error("[db] Unexpected idle client error", err.message);
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
 * Transaction helper — one connection for begin/work/commit (pgbouncer OK).
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

/** Query with one automatic retry on session pool exhaustion. */
export async function queryWithRetry<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  try {
    return await getPool().query<T>(text, params);
  } catch (err) {
    if (!isMaxConnSessionError(err)) throw err;
    await new Promise((r) => setTimeout(r, 400));
    return getPool().query<T>(text, params);
  }
}
