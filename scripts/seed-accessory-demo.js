/**
 * Apply accessory schema + DEMO seed to DB (.env.local).
 * Usage: node scripts/seed-accessory-demo.js
 *
 * Xóa demo sau:
 *   node scripts/seed-accessory-demo.js --cleanup
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

const cleanup = process.argv.includes("--cleanup");

const MIGRATIONS = [
  "20260714120000_accessories_category_brand_note.sql",
  "20260714130000_accessory_price_cost_lookups.sql",
  "20260714140000_accessory_code_name_lookups.sql",
  "20260714150000_accessory_demo_seed.sql",
];

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Missing DIRECT_URL / DATABASE_URL");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("Connected.");

  try {
    if (cleanup) {
      await client.query("begin");
      const delAcc = await client.query(
        `delete from public.accessories
         where code like 'DEMO-%' or note like '%[DEMO-SEED]%'`
      );
      const delLookup = await client.query(
        `delete from public.lookup_items
         where code like 'demo-%'
           and category_id in (
             select id from public.lookup_categories
             where code like 'accessory_%'
           )`
      );
      await client.query("commit");
      console.log(
        `Cleanup OK: accessories=${delAcc.rowCount}, lookup_items=${delLookup.rowCount}`
      );
      return;
    }

    for (const file of MIGRATIONS) {
      const sqlPath = path.join("supabase", "migrations", file);
      if (!fs.existsSync(sqlPath)) {
        console.warn("Skip missing:", file);
        continue;
      }
      const sql = fs.readFileSync(sqlPath, "utf8");
      console.log("Applying", file, "...");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("commit");
        console.log("  OK");
      } catch (err) {
        await client.query("rollback").catch(() => {});
        // idempotent-ish: log and continue if already applied partially
        console.error("  FAIL:", err.message);
        throw err;
      }
    }

    const { rows } = await client.query(
      `select a.code, a.name, a.category, a.brand, a.quantity, a.price, s.code as store
       from public.accessories a
       join public.stores s on s.id = a.store_id
       where a.code like 'DEMO-%' or a.note like '%[DEMO-SEED]%'
       order by s.code, a.code`
    );
    console.log("Demo accessories:", rows.length);
    for (const r of rows) {
      console.log(
        `  [${r.store}] ${r.code} | ${r.category}/${r.brand} | ${r.name} | SL=${r.quantity} | giá=${r.price}`
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
