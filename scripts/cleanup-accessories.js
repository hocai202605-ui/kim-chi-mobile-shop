/**
 * Xóa dữ liệu phụ kiện (accessories + lookup demo accessory_*).
 * KHÔNG xóa phones / sale_items phone.
 *
 * Usage: node scripts/cleanup-accessories.js
 *        node scripts/cleanup-accessories.js --demo-only   // chỉ DEMO-%
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

const demoOnly = process.argv.includes("--demo-only");

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
  console.log("Connected. Mode:", demoOnly ? "demo-only" : "ALL accessories");

  try {
    await client.query("begin");

    // sale_items gắn phụ kiện phải xóa/null trước nếu có FK
    let saleItems = { rowCount: 0 };
    try {
      if (demoOnly) {
        saleItems = await client.query(
          `delete from public.sale_items si
           using public.accessories a
           where si.accessory_id = a.id
             and (a.code like 'DEMO-%' or a.note like '%[DEMO-SEED]%')`
        );
      } else {
        saleItems = await client.query(
          `delete from public.sale_items where accessory_id is not null`
        );
      }
    } catch (e) {
      console.warn("sale_items accessory cleanup skipped:", e.message);
    }

    let acc;
    if (demoOnly) {
      acc = await client.query(
        `delete from public.accessories
         where code like 'DEMO-%' or note like '%[DEMO-SEED]%'`
      );
    } else {
      acc = await client.query(`delete from public.accessories`);
    }

    // Lookup options demo / hoặc toàn bộ accessory_* user options (code demo-*)
    let lookups = { rowCount: 0 };
    try {
      if (demoOnly) {
        lookups = await client.query(
          `delete from public.lookup_items
           where code like 'demo-%'
             and category_id in (
               select id from public.lookup_categories where code like 'accessory_%'
             )`
        );
      } else {
        // Xóa option droplist phụ kiện (không đụng phone_*)
        lookups = await client.query(
          `delete from public.lookup_items
           where category_id in (
             select id from public.lookup_categories where code like 'accessory_%'
           )`
        );
      }
    } catch (e) {
      console.warn("lookup cleanup skipped:", e.message);
    }

    await client.query("commit");

    const leftAcc = await client.query(
      `select count(*)::int as n from public.accessories`
    );
    const leftPhones = await client.query(
      `select count(*)::int as n from public.phones`
    );

    console.log("Deleted sale_items (accessory):", saleItems.rowCount);
    console.log("Deleted accessories:", acc.rowCount);
    console.log("Deleted accessory lookup_items:", lookups.rowCount);
    console.log("Remaining accessories:", leftAcc.rows[0].n);
    console.log("Remaining phones (unchanged):", leftPhones.rows[0].n);
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
