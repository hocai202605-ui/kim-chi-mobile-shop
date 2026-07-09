/**
 * Delete all phones so IMEIs can be re-inserted.
 * Usage: node scripts/delete-all-phones.js
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv() {
  const text = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
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
  const env = loadEnv();
  const url = env.DATABASE_URL || env.DIRECT_URL;
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const before = await client.query(
    "select count(*)::int as n, array_agg(imei) as imeis from public.phones"
  );
  console.log("Before:", before.rows[0].n, "IMEIs:", before.rows[0].imeis);

  await client.query("begin");
  try {
    // Drop FK refs from sale lines (nullable phone_id) or delete phone sale rows
    try {
      const u = await client.query(
        "update public.sale_items set phone_id = null where phone_id is not null"
      );
      console.log("Cleared sale_items.phone_id:", u.rowCount);
    } catch (err) {
      const d = await client.query(
        "delete from public.sale_items where item_type = 'phone'"
      );
      console.log("Deleted phone sale_items:", d.rowCount, "(", err.message, ")");
    }

    const del = await client.query("delete from public.phones");
    console.log("Deleted phones:", del.rowCount);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  }

  const after = await client.query(
    "select count(*)::int as n from public.phones"
  );
  console.log("Remaining phones:", after.rows[0].n);
  await client.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
