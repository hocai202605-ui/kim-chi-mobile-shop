/**
 * List and terminate idle/hanging Postgres sessions (Supabase).
 * Usage: node scripts/kill-idle-sessions.js [--dry-run]
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const text = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const env = loadEnv();
  // Prefer transaction pooler first — session mode may already be full (EMAXCONNSESSION).
  const candidates = [env.DATABASE_URL, env.DIRECT_URL].filter(Boolean);
  if (candidates.length === 0) {
    console.error("Missing DIRECT_URL / DATABASE_URL in .env.local");
    process.exit(1);
  }

  let client;
  let lastErr;
  for (const connectionString of candidates) {
    const c = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15_000,
    });
    try {
      await c.connect();
      client = c;
      const mode = String(connectionString).includes(":6543")
        ? "transaction(:6543)"
        : "session(:5432)";
      console.log("Connected via", mode);
      break;
    } catch (err) {
      lastErr = err;
      await c.end().catch(() => {});
      console.warn("Connect failed:", err.message);
    }
  }
  if (!client) {
    throw lastErr || new Error("Could not connect");
  }

  const me = await client.query("select pg_backend_pid() as pid");
  const myPid = me.rows[0].pid;
  console.log("Connected. my_pid =", myPid, dryRun ? "(dry-run)" : "");

  const list = await client.query(`
    select
      pid,
      usename,
      application_name,
      client_addr::text as client_addr,
      state,
      wait_event_type,
      wait_event,
      left(coalesce(query, ''), 100) as query,
      (now() - state_change) as state_age,
      (now() - backend_start) as backend_age
    from pg_stat_activity
    where datname = current_database()
    order by backend_start
  `);

  console.log("\n=== Sessions on current DB ===");
  for (const r of list.rows) {
    const mark = r.pid === myPid ? " [ME]" : "";
    console.log(
      `pid=${r.pid} user=${r.usename} state=${r.state} app=${r.application_name || "-"} age=${r.state_age}${mark}`
    );
    console.log(`  query: ${r.query}`);
  }
  console.log("total:", list.rows.length);

  // Only kill app pooler backends owned by the DB role (postgres / project user).
  // Never touch PostgREST, pg_cron, exporters, or pgbouncer auth helpers.
  const targets = await client.query(
    `
    select pid, usename, state, application_name,
           (now() - state_change)::text as state_age
    from pg_stat_activity
    where datname = current_database()
      and pid <> $1
      and pid <> pg_backend_pid()
      and backend_type = 'client backend'
      and usename in ('postgres', current_user)
      and coalesce(application_name, '') in ('', 'Supavisor', 'pg')
      and application_name is distinct from 'PostgREST'
      and usename not in (
        'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin',
        'supabase_functions_admin', 'supabase_replication_admin',
        'authenticator', 'pgbouncer'
      )
      and (
        state = 'idle'
        or state = 'idle in transaction'
        or state = 'idle in transaction (aborted)'
      )
    `,
    [myPid]
  );

  console.log("\n=== Targets to terminate ===");
  if (targets.rows.length === 0) {
    console.log("No idle client sessions to kill.");
  } else {
    for (const r of targets.rows) {
      console.log(
        `pid=${r.pid} user=${r.usename} state=${r.state} app=${r.application_name || "-"} age=${r.state_age}`
      );
      if (!dryRun) {
        const res = await client.query(
          "select pg_terminate_backend($1) as killed",
          [r.pid]
        );
        console.log("  -> terminated:", res.rows[0].killed);
      }
    }
  }

  if (!dryRun) {
    // brief pause then re-list
    await new Promise((r) => setTimeout(r, 500));
    const after = await client.query(`
      select count(*)::int as n
      from pg_stat_activity
      where datname = current_database()
        and backend_type = 'client backend'
    `);
    console.log("\nClient backends remaining:", after.rows[0].n);
  }

  await client.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
