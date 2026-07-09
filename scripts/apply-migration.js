/**
 * Apply a SQL migration file using DIRECT_URL env (session mode).
 * Usage: set DIRECT_URL=... && node scripts/apply-migration.js [path-to.sql]
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const sqlPath =
    process.argv[2] ||
    path.join("supabase", "migrations", "20260709100001_inventory_foundation.sql");
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("Missing DIRECT_URL (or DATABASE_URL) env var");
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected. Applying:", sqlPath);

  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log("Migration applied OK");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  }

  const tables = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by 1
  `);
  console.log("Public tables:");
  for (const row of tables.rows) {
    console.log(" -", row.table_name);
  }

  const cats = await client.query(
    `select code from public.lookup_categories order by sort_order`
  );
  console.log("Lookup categories:", cats.rows.map((r) => r.code).join(", "));

  const stores = await client.query(`select code, name from public.stores order by code`);
  console.log("Stores:", stores.rows.map((r) => r.code).join(", "));

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
