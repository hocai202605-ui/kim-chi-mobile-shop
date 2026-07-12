/**
 * Verify created_by / updated_by backfill.
 * Usage: node scripts/verify-actor-backfill.js
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0 || line.startsWith("#")) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const tables = [
    "phones",
    "accessories",
    "software_orders",
    "lookup_items",
    "sales",
    "sale_items",
    "customers",
    "app_accounts",
    "stores",
  ];

  for (const t of tables) {
    const r = await client.query(
      `select count(*)::int as total,
              count(*) filter (where created_by = 'quynhbupbe')::int as created_by_ok,
              count(*) filter (where updated_by = 'quynhbupbe')::int as updated_by_ok
       from public.${t}`
    );
    console.log(t, r.rows[0]);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
