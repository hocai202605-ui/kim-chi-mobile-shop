const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const sqlPath =
    process.argv[2] ||
    path.join("supabase", "migrations", "20260709120000_drop_business_unique_indexes.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = new Client({
    connectionString: env.DATABASE_URL || env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("Applying", sqlPath);
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  }

  const idx = await client.query(`
    select tablename, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
      and tablename in ('phones', 'accessories', 'sale_items')
    order by tablename, indexname
  `);
  console.log("\nIndexes:");
  for (const r of idx.rows) {
    console.log(`- ${r.tablename}.${r.indexname}`);
    console.log(`  ${r.indexdef}`);
  }

  const uniq = await client.query(`
    select tablename, indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename in ('phones', 'accessories', 'sale_items')
      and indexdef ilike '%UNIQUE%'
  `);
  console.log("\nRemaining UNIQUE indexes:", uniq.rows.length ? uniq.rows : "none");
  await client.end();
  console.log("OK");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
