/* Probe audit_logs table + list query used by app. */
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  const env = {};
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

function resolveUrl(env) {
  let url = (env.DATABASE_URL || env.DIRECT_URL || "").trim();
  if (!url) throw new Error("Thiếu DATABASE_URL / DIRECT_URL");
  if (/pooler\.supabase\.com:5432\b/i.test(url)) {
    url = url.replace(/:5432\b/, ":6543");
    if (!/[?&]pgbouncer=true/i.test(url)) {
      url += url.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
    }
  }
  return url;
}

function vnDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  const env = loadEnv();
  const url = resolveUrl(env);
  console.log("url host:", url.replace(/:[^:@/]+@/, ":***@").slice(0, 80));
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 20000,
  });

  try {
    const reg = await pool.query(
      `select to_regclass('public.audit_logs') as t`
    );
    console.log("to_regclass:", reg.rows[0]);

    if (!reg.rows[0]?.t) {
      console.log("FAIL: table public.audit_logs does not exist");
      return;
    }

    const cols = await pool.query(
      `select column_name, data_type
       from information_schema.columns
       where table_schema='public' and table_name='audit_logs'
       order by ordinal_position`
    );
    console.log(
      "columns:",
      cols.rows.map((r) => `${r.column_name}:${r.data_type}`).join(", ")
    );

    const cnt = await pool.query(
      `select count(*)::int as c from public.audit_logs`
    );
    console.log("total rows:", cnt.rows[0].c);

    const stores = await pool.query(
      `select id, code, name from public.stores where is_active = true`
    );
    console.log("stores:", stores.rows);

    const from = vnDateOffset(-30);
    const to = vnDateOffset(0);
    console.log("filter range:", from, "→", to);

    const list = await pool.query(
      `select id, created_at, actor_name, store_id, action, target
       from public.audit_logs
       where created_at >= ($1::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
         and created_at < (($2::date + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
       order by created_at desc
       limit 5 offset 0`,
      [from + " 00:00:00", to]
    );
    console.log("list in range:", list.rows.length, list.rows);

    // try insert + delete test row
    const storeId = stores.rows[0]?.id || null;
    const ins = await pool.query(
      `insert into public.audit_logs (actor_name, store_id, action, target, meta)
       values ($1, $2, $3, $4, '{}'::jsonb)
       returning id, created_at, actor_name, action`,
      ["probe-script", storeId, "Probe nhật ký", "test"]
    );
    console.log("insert ok:", ins.rows[0]);
    await pool.query(`delete from public.audit_logs where id = $1`, [
      ins.rows[0].id,
    ]);
    console.log("delete probe ok");
  } catch (e) {
    console.error("ERR:", e.message);
    if (e.code) console.error("code:", e.code);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
